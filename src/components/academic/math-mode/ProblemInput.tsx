"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import styles from "./MathDocument/MathDocument.module.css";

export default function ProblemInput({
  problemStatement,
  onProblemChange,
  onStart,
  inputRef,
  onOpenKeyboard,
  keyboard,
}: {
  problemStatement: string;
  onProblemChange: (value: string) => void;
  onStart: () => void;
  inputRef: React.Ref<HTMLTextAreaElement>;
  onOpenKeyboard: () => void;
  keyboard?: ReactNode;
}) {
  const t = useTranslations();
  return (
    <>
      <div className={styles.startWrap}>
        <div className={styles.startCanvas}>
          <p className={styles.subheading}>{t("academic.mathMode.problemInput.worksheet")}</p>
          <h2 className={styles.heading}>{t("academic.mathMode.problemInput.title")}</h2>
          <p className={styles.canvasHelper}>
            {t("academic.mathMode.problemInput.helper")}
          </p>
        </div>
        <div className={styles.inputDock}>
          <div className={styles.startHeaderRow}>
            <button
              type="button"
              className={styles.startButton}
              onClick={onStart}
              disabled={!problemStatement.trim()}
            >
              {t("academic.entry.startProblem")}
            </button>
          </div>
          <textarea
            ref={inputRef}
            value={problemStatement}
            onChange={(event) => onProblemChange(event.target.value)}
            onClick={onOpenKeyboard}
            onKeyDown={(event) => {
              if (event.key.toLowerCase() === "enter" && !event.shiftKey) {
                event.preventDefault();
                if (problemStatement.trim()) onStart();
              }
            }}
            placeholder={t("academic.mathMode.problemInput.placeholder")}
            className={styles.problemInput}
            rows={2}
          />
          <p className={styles.startHint}>{t("academic.mathMode.problemInput.startHint")}</p>
        </div>
      </div>
      {keyboard}
    </>
  );
}
