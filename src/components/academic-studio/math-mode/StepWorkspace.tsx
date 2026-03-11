"use client";

import type { MathStep } from "@/types/math-mode";
import MathStepCanvas from "./MathStepCanvas";
import StepRecovery from "./StepRecovery";
import styles from "./MathDocument/MathDocument.module.css";
import type { MathfieldElement } from "./mathfield";

export default function StepWorkspace({
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
  onActiveFieldChange,
}: {
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
  onRequestHint?: () => void;
  onAskVictorStep?: (step: MathStep, stepNumber: number) => void;
  onMarkFinalAnswer?: (stepId: string) => void;
  isCompletingSession?: boolean;
  isWorkspaceLocked?: boolean;
  isVerifying: boolean;
  onActiveFieldChange: (field: MathfieldElement | null) => void;
}) {
  const sortedSteps = [...steps].sort((a, b) => a.step_number - b.step_number);
  const lastStep = sortedSteps[sortedSteps.length - 1] || null;
  const canUndo =
    Boolean(lastStep) &&
    ["unchecked", "incorrect"].includes(
      String(lastStep?.status || "")
    );
  const lastVerified = [...sortedSteps]
    .reverse()
    .find((step) => ["correct", "equivalent_form"].includes(step.status));
  const revertCount = lastVerified
    ? sortedSteps.filter((step) => step.step_number > lastVerified.step_number).length
    : 0;
  const canRevert = revertCount > 0;

  return (
    <>
      <h2 className={styles.heading}>Problem</h2>
      <p className={styles.problemText}>{problemStatement}</p>
      {isWorkspaceLocked && (
        <div className="mb-3 rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
          Problem complete.
        </div>
      )}
      <div className={styles.canvasWrap}>
        <MathStepCanvas
          steps={steps}
          onAddStep={onAddStep}
          onVerifyAll={onVerifyAll}
          onVerifyStep={onVerifyStep}
          onUpdateStep={onStepChange}
          onDeleteStep={onDeleteStep}
          onFlagForReview={onFlagForReview}
          verifyingStepId={verifyingStepId}
          onRequestHint={onRequestHint}
          onAskVictorStep={onAskVictorStep}
          onMarkFinalAnswer={onMarkFinalAnswer}
          isCompletingSession={isCompletingSession}
          isWorkspaceLocked={isWorkspaceLocked}
          onActiveFieldChange={onActiveFieldChange}
          isVerifying={isVerifying}
        />
        <StepRecovery
          canUndo={canUndo}
          canRevert={canRevert}
          revertCount={revertCount}
          busy={isVerifying || Boolean(isWorkspaceLocked)}
          onUndo={onUndoLastStep}
          onRevert={onRevertToLastVerified}
        />
      </div>
    </>
  );
}
