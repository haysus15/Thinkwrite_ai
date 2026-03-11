"use client";

import { useEffect, useMemo, useState } from "react";
import type { ScaffoldedStep } from "@/types/academic-studio";
import styles from "./StepCard.module.css";

type StepCardProps = {
  step: ScaffoldedStep;
  totalSteps: number;
  isLocked: boolean;
  isActive: boolean;
  onSubmitAttempt: (attempt: string) => void;
  loading: boolean;
};

function getBadge(step: ScaffoldedStep, isLocked: boolean, isActive: boolean) {
  if (isLocked) {
    return { label: "Locked", className: styles.badgeLocked };
  }
  if (isActive) {
    return { label: "Active", className: "" };
  }
  if (step.attemptResult === "correct") {
    return { label: "Complete", className: styles.badgeCorrect };
  }
  if (step.attemptResult === "partial") {
    return { label: "Gap", className: styles.badgeGap };
  }
  if (step.attemptResult === "misconception") {
    return { label: "Reteach", className: styles.badgeMisconception };
  }
  return { label: "Open", className: "" };
}

export default function StepCard({
  step,
  totalSteps,
  isLocked,
  isActive,
  onSubmitAttempt,
  loading,
}: StepCardProps) {
  const [expanded, setExpanded] = useState(isActive || !isLocked);
  const [attempt, setAttempt] = useState(step.studentAttempt || "");

  useEffect(() => {
    setAttempt(step.studentAttempt || "");
  }, [step.studentAttempt]);

  useEffect(() => {
    if (isActive) {
      setExpanded(true);
      return;
    }
    const completed = step.attemptResult !== null;
    if (completed) {
      setExpanded(false);
    }
  }, [isActive, step.attemptResult]);

  const badge = useMemo(() => getBadge(step, isLocked, isActive), [isActive, isLocked, step]);
  const canSubmit =
    isActive &&
    Boolean(step.gap) &&
    !loading &&
    attempt.trim().length > 0 &&
    step.attemptResult !== "correct";

  const headerClass = [
    styles.header,
    isLocked ? styles.headerLocked : "",
    isActive ? styles.headerActive : "",
  ]
    .filter(Boolean)
    .join(" ");

  const showInput = isActive && Boolean(step.gap);

  return (
    <article className={styles.card}>
      <button
        type="button"
        className={headerClass}
        onClick={() => {
          if (isActive) return;
          setExpanded((prev) => !prev);
        }}
      >
        <div>
          <div className={styles.stepMeta}>
            <span className={styles.stepIndex}>
              Step {step.stepNumber} of {totalSteps}
            </span>
            <span className={`${styles.badge} ${badge.className}`}>{badge.label}</span>
          </div>
          <div className={styles.title}>{step.title || `Step ${step.stepNumber}`}</div>
        </div>
        <span className="text-xs text-slate-400">{expanded ? "Collapse" : "Expand"}</span>
      </button>

      {expanded && !isLocked && (
        <div className={styles.content}>
          {step.instruction ? <p className={styles.text}>{step.instruction}</p> : null}
          {step.gap ? <p className={styles.gap}>{step.gap}</p> : null}

          {showInput ? (
            <>
              <textarea
                value={attempt}
                onChange={(event) => setAttempt(event.target.value)}
                rows={3}
                className={styles.input}
                placeholder="Write your attempt for this gap."
                disabled={loading || step.attemptResult === "correct"}
              />
              <div className={styles.row}>
                <button
                  type="button"
                  className={styles.button}
                  disabled={!canSubmit}
                  onClick={() => onSubmitAttempt(attempt.trim())}
                >
                  Submit attempt
                </button>
              </div>
            </>
          ) : null}

          {step.victorFeedback ? <div className={styles.feedback}>{step.victorFeedback}</div> : null}

          {step.subSteps.length > 0 ? (
            <div className={styles.subSteps}>
              {step.subSteps.map((subStep, index) => (
                <div key={`${subStep.stepNumber}-${index}`} className={styles.subStep}>
                  <p className={styles.subStepTitle}>{subStep.title || "Reteach"}</p>
                  <p className={styles.subStepText}>{subStep.instruction}</p>
                  {subStep.gap ? <p className={styles.subStepText}>Gap: {subStep.gap}</p> : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </article>
  );
}
