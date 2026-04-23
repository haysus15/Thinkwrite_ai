"use client";

import { useEffect, useRef, useState } from "react";
import MathSymbolPalette from "../MathSymbolPalette";
import type { MathStep } from "@/types/math-mode";
import ProblemInput from "../ProblemInput";
import StepWorkspace from "../StepWorkspace";
import styles from "./MathDocument.module.css";
import type { MathfieldElement } from "../mathfield";

interface MathDocumentProps {
  problemStatement: string;
  steps: MathStep[];
  onStepChange: (stepId: string, value: string, reasoning?: string) => void;
  onAddStep: () => void;
  onDeleteStep: (id: string) => void;
  onUndoLastStep: () => void;
  onRevertToLastVerified: () => void;
  onFlagForReview: (id: string) => void;
  onVerifyStep: (id: string) => void;
  verifyingStepId: string | null;
  onVerifyAll: () => void;
  onRequestHint: () => void;
  onAskVictorStep: (step: MathStep, stepNumber: number) => void;
  onMarkFinalAnswer?: (stepId: string) => void;
  isCompletingSession?: boolean;
  isWorkspaceLocked?: boolean;
  isVerifying: boolean;
  isStarted: boolean;
  onStart: () => void;
  onActiveFieldChange: (field: MathfieldElement | null) => void;
  onProblemChange: (value: string) => void;
}

export default function MathDocument({
  problemStatement,
  steps,
  onStepChange,
  onAddStep,
  onDeleteStep,
  onUndoLastStep,
  onRevertToLastVerified,
  onFlagForReview,
  onVerifyStep,
  verifyingStepId,
  onVerifyAll,
  onRequestHint,
  onAskVictorStep,
  onMarkFinalAnswer,
  isCompletingSession,
  isWorkspaceLocked,
  isVerifying,
  isStarted,
  onStart,
  onActiveFieldChange,
  onProblemChange,
}: MathDocumentProps) {
  const problemInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [keyboardAnchor, setKeyboardAnchor] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const insertSymbolIntoProblem = (symbol: string) => {
    const input = problemInputRef.current;
    if (!input) return;

    const start = input.selectionStart ?? problemStatement.length;
    const end = input.selectionEnd ?? start;

    if (symbol === "⌫") {
      const deleteStart = start === end ? Math.max(0, start - 1) : start;
      const next =
        problemStatement.slice(0, deleteStart) + problemStatement.slice(end);
      onProblemChange(next);
      requestAnimationFrame(() => {
        input.focus();
        input.setSelectionRange(deleteStart, deleteStart);
      });
      return;
    }

    if (symbol === "←" || symbol === "→") {
      const nextPos =
        symbol === "←" ? Math.max(0, start - 1) : Math.min(problemStatement.length, end + 1);
      requestAnimationFrame(() => {
        input.focus();
        input.setSelectionRange(nextPos, nextPos);
      });
      return;
    }

    const next =
      problemStatement.slice(0, start) + symbol + problemStatement.slice(end);
    const caret = start + symbol.length;
    onProblemChange(next);
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(caret, caret);
    });
  };

  const openKeyboard = () => {
    const input = problemInputRef.current;
    if (!input) return;
    const rect = input.getBoundingClientRect();
    setKeyboardAnchor({
      top: rect.bottom,
      left: rect.left,
      width: rect.width,
    });
    setShowKeyboard(true);
  };

  useEffect(() => {
    if (!showKeyboard || isStarted) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const inInput = Boolean(problemInputRef.current?.contains(target));
      const inPalette = Boolean(target.closest("[data-math-floating-palette='true']"));
      if (!inInput && !inPalette) {
        setShowKeyboard(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [showKeyboard, isStarted]);

  useEffect(() => {
    if (isStarted) return;
    problemInputRef.current?.focus();
  }, [isStarted]);

  return (
    <section className={styles.document}>
      {!isStarted && (
        <ProblemInput
          problemStatement={problemStatement}
          onProblemChange={onProblemChange}
          onStart={onStart}
          inputRef={problemInputRef}
          onOpenKeyboard={openKeyboard}
          keyboard={
            showKeyboard &&
            keyboardAnchor && (
              <div data-math-floating-palette="true">
                <MathSymbolPalette
                  onInsert={insertSymbolIntoProblem}
                  variant="dock"
                  floatingAnchor={keyboardAnchor}
                />
              </div>
            )
          }
        />
      )}

      {isStarted && (
        <StepWorkspace
          problemStatement={problemStatement}
          steps={steps}
          onStepChange={onStepChange}
          onAddStep={onAddStep}
          onDeleteStep={onDeleteStep}
          onUndoLastStep={onUndoLastStep}
          onRevertToLastVerified={onRevertToLastVerified}
          onFlagForReview={onFlagForReview}
          onVerifyStep={onVerifyStep}
          verifyingStepId={verifyingStepId}
          onVerifyAll={onVerifyAll}
          onRequestHint={onRequestHint}
          onAskVictorStep={onAskVictorStep}
          onMarkFinalAnswer={onMarkFinalAnswer}
          isCompletingSession={isCompletingSession}
          isWorkspaceLocked={isWorkspaceLocked}
          isVerifying={isVerifying}
          onActiveFieldChange={onActiveFieldChange}
        />
      )}
    </section>
  );
}
