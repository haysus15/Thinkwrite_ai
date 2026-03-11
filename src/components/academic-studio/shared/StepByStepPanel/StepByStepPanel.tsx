"use client";

import { useMemo, useState } from "react";
import type { SystemStep, VictorHandoffContext } from "@/lib/academic/teachingEngine";
import styles from "./StepByStepPanel.module.css";

interface StepByStepPanelProps {
  steps: SystemStep[];
  currentStepIndex: number;
  onRequestNextStep: (stepNumber: number) => void;
  onStepAttempt: (stepNumber: number, attempt: string) => void;
  onRequestHint: (stepNumber: number) => void;
  onRequestVictorHelp: (stepNumber: number) => void;
  onVictorAutoIntervene?: (handoffContext: VictorHandoffContext) => void;
  isLoading: boolean;
}

export default function StepByStepPanel({
  steps,
  currentStepIndex,
  onRequestNextStep,
  onStepAttempt,
  onRequestHint,
  onRequestVictorHelp,
  isLoading,
}: StepByStepPanelProps) {
  const [attempts, setAttempts] = useState<Record<number, string>>({});
  const [shownHints, setShownHints] = useState<Record<number, boolean>>({});
  const [dismissedNotice, setDismissedNotice] = useState<Record<number, boolean>>({});

  const total = steps.length;
  const activeStepNumber = Math.max(1, Math.min(total, currentStepIndex + 1));

  const visibleSteps = useMemo(
    () =>
      steps.map((step, index) => {
        const locked = !step.revealed && index > currentStepIndex;
        const active = index === currentStepIndex;
        const complete = index < currentStepIndex;
        return { step, index, locked, active, complete };
      }),
    [currentStepIndex, steps]
  );

  const submitAttempt = (stepNumber: number) => {
    const value = (attempts[stepNumber] || "").trim();
    if (!value) return;
    onStepAttempt(stepNumber, value);
    setAttempts((prev) => ({ ...prev, [stepNumber]: "" }));
  };

  const requestNextStep = (stepNumber: number) => {
    const nextStepNumber = Math.min(Math.max(1, stepNumber + 1), Math.max(1, total));
    onRequestNextStep(nextStepNumber);
  };

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <p className={styles.eyebrow}>Step-By-Step Guidance</p>
        <p className={styles.progress}>
          Step {activeStepNumber} of {Math.max(1, total)}
        </p>
      </div>

      <div className={styles.list}>
        {visibleSteps.map(({ step, index, locked, active, complete }) => {
          const key = step.stepNumber;
          const showHint = shownHints[key] === true;
          const showStruggle =
            step.struggleDetected && dismissedNotice[key] !== true && active;
          const editable = !locked && (active || complete);

          return (
            <article
              key={`sys-step-${key}`}
              className={`${styles.step} ${locked ? styles.stepLocked : ""}`}
            >
              <button
                type="button"
                className={styles.stepHeader}
                onClick={() => {
                  if (locked || active) return;
                  if (complete) return;
                  onRequestNextStep(step.stepNumber);
                }}
              >
                <p className={styles.stepTitle}>{step.title || `Step ${key}`}</p>
                <p className={styles.stepMeta}>
                  Step {key} {locked ? "· Locked" : active ? "· Active" : complete ? "· Complete" : ""}
                </p>
              </button>

              {!locked && (
                <div className={styles.body}>
                  <p className={styles.text}>{step.instruction}</p>

                  {showHint ? <div className={styles.hint}>{step.hint}</div> : null}

                  {editable && (
                    <>
                      <textarea
                        className={styles.input}
                        rows={3}
                        value={attempts[key] || ""}
                        onChange={(event) =>
                          setAttempts((prev) => ({ ...prev, [key]: event.target.value }))
                        }
                        placeholder="Write your attempt for this step."
                        disabled={isLoading}
                      />

                      <div className={styles.actions}>
                        <button
                          type="button"
                          className={styles.btnPrimary}
                          onClick={() => submitAttempt(key)}
                          disabled={isLoading || !(attempts[key] || "").trim()}
                        >
                          Submit attempt
                        </button>
                        <button
                          type="button"
                          className={styles.btnSecondary}
                          onClick={() => {
                            setShownHints((prev) => ({ ...prev, [key]: true }));
                            onRequestHint(key);
                          }}
                          disabled={isLoading}
                        >
                          Give me a hint
                        </button>
                        <button
                          type="button"
                          className={styles.btnVictor}
                          onClick={() => onRequestVictorHelp(key)}
                          disabled={isLoading}
                        >
                          Ask Victor to explain this
                        </button>
                        {active && index < steps.length - 1 && (
                          <button
                            type="button"
                            className={styles.btnSecondary}
                            onClick={() => requestNextStep(key)}
                            disabled={isLoading}
                          >
                            Request next step
                          </button>
                        )}
                      </div>
                    </>
                  )}

                  {showStruggle && (
                    <div className={styles.struggleNotice}>
                      <p className={styles.struggleText}>
                        Victor noticed you&apos;ve been working on this step. He can help.
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className={styles.btnVictor}
                          onClick={() => {
                            onRequestVictorHelp(key);
                          }}
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          className={styles.btnSecondary}
                          onClick={() =>
                            setDismissedNotice((prev) => ({ ...prev, [key]: true }))
                          }
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
