"use client";

import type { ReactNode } from "react";
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
  return (
    <>
      <div className={styles.startWrap}>
        <div className={styles.startCanvas}>
          <p className={styles.subheading}>Worksheet</p>
          <h2 className={styles.heading}>Enter your problem</h2>
          <p className={styles.canvasHelper}>
            Start with a full equation or expression.
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
              Start problem
            </button>
          </div>
          <textarea
            ref={inputRef}
            value={problemStatement}
            onChange={(event) => onProblemChange(event.target.value)}
            onClick={onOpenKeyboard}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (problemStatement.trim()) onStart();
              }
            }}
            placeholder="Enter your math problem to get started"
            className={styles.problemInput}
            rows={2}
          />
          <p className={styles.startHint}>Press Enter to start, Shift+Enter for a new line.</p>
        </div>
      </div>
      {keyboard}
    </>
  );
}
