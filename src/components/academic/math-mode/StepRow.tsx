"use client";

import type { MathStep } from "@/types/math-mode";
import MathStepEditor from "./MathStepEditor";
import type { MathfieldElement } from "./mathfield";

export default function StepRow({
  step,
  stepNumber,
  onUpdate,
  onVerify,
  onDelete,
  onAddStep,
  onFlagForReview,
  onHint,
  onAskVictor,
  onMarkFinalAnswer,
  isLastStep,
  isCompletingSession,
  isWorkspaceLocked,
  onActiveFieldChange,
  isVerifying,
}: {
  step: MathStep;
  stepNumber: number;
  onUpdate: (id: string, latex: string, reasoning?: string) => void;
  onVerify: (id: string) => void;
  onDelete: (id: string) => void;
  onAddStep: () => void;
  onFlagForReview: (id: string) => void;
  onHint?: () => void;
  onAskVictor?: () => void;
  onMarkFinalAnswer?: (id: string) => void;
  isLastStep?: boolean;
  isCompletingSession?: boolean;
  isWorkspaceLocked?: boolean;
  onActiveFieldChange: (field: MathfieldElement | null) => void;
  isVerifying?: boolean;
}) {
  return (
    <MathStepEditor
      step={step}
      stepNumber={stepNumber}
      onUpdate={onUpdate}
      onVerify={onVerify}
      onDelete={onDelete}
      onAddStep={onAddStep}
      onFlagForReview={onFlagForReview}
      onHint={onHint}
      onAskVictor={onAskVictor}
      onMarkFinalAnswer={onMarkFinalAnswer}
      isLastStep={isLastStep}
      isCompletingSession={isCompletingSession}
      isWorkspaceLocked={isWorkspaceLocked}
      onActiveFieldChange={onActiveFieldChange}
      isVerifying={isVerifying}
    />
  );
}
