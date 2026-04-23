"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { ScaffoldedStep } from "@/types/academic";
import styles from "./StepCard.module.css";

type StepCardProps = {
  step: ScaffoldedStep;
  totalSteps: number;
  isLocked: boolean;
  isActive: boolean;
  onSubmitAttempt: (attempt: string) => void;
  loading: boolean;
};

function getBadge(
  step: ScaffoldedStep,
  isLocked: boolean,
  isActive: boolean,
  t: ReturnType<typeof useTranslations>
) {
  if (isLocked) {
    return { label: t("badges.locked"), className: styles.badgeLocked };
  }
  if (isActive) {
    return { label: t("badges.active"), className: "" };
  }
  if (step.attemptResult === "correct") {
    return { label: t("badges.complete"), className: styles.badgeCorrect };
  }
  if (step.attemptResult === "partial") {
    return { label: t("badges.gap"), className: styles.badgeGap };
  }
  if (step.attemptResult === "misconception") {
    return { label: t("badges.reteach"), className: styles.badgeMisconception };
  }
  return { label: t("badges.open"), className: "" };
}

export default function StepCard({
  step,
  totalSteps,
  isLocked,
  isActive,
  onSubmitAttempt,
  loading,
}: StepCardProps) {
  const t = useTranslations("academic.victorUi.stepCard");
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

  const badge = useMemo(() => getBadge(step, isLocked, isActive, t), [isActive, isLocked, step, t]);
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
              {t("stepProgress", { current: step.stepNumber, total: totalSteps })}
            </span>
            <span className={`${styles.badge} ${badge.className}`}>{badge.label}</span>
          </div>
          <div className={styles.title}>{step.title || t("stepFallback", { index: step.stepNumber })}</div>
        </div>
        <span className="text-xs text-slate-400">{expanded ? t("collapse") : t("expand")}</span>
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
                placeholder={t("attemptPlaceholder")}
                disabled={loading || step.attemptResult === "correct"}
              />
              <div className={styles.row}>
                <button
                  type="button"
                  className={styles.button}
                  disabled={!canSubmit}
                  onClick={() => onSubmitAttempt(attempt.trim())}
                >
                  {t("submitAttempt")}
                </button>
              </div>
            </>
          ) : null}

          {step.victorFeedback ? <div className={styles.feedback}>{step.victorFeedback}</div> : null}

          {step.subSteps.length > 0 ? (
            <div className={styles.subSteps}>
              {step.subSteps.map((subStep, index) => (
                <div key={`${subStep.stepNumber}-${index}`} className={styles.subStep}>
                  <p className={styles.subStepTitle}>{subStep.title || t("subStepFallback")}</p>
                  <p className={styles.subStepText}>{subStep.instruction}</p>
                  {subStep.gap ? <p className={styles.subStepText}>{t("gapLabel")}: {subStep.gap}</p> : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </article>
  );
}
