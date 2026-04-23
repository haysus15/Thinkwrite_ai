"use client";

import { useTranslations } from "next-intl";
import type { MathStep } from "@/types/math-mode";
import StepRow from "./StepRow";
import type { MathfieldElement } from "./mathfield";

export default function MathStepCanvas({
  steps,
  onAddStep,
  onVerifyAll,
  onVerifyStep,
  onUpdateStep,
  onDeleteStep,
  onFlagForReview,
  onRequestHint,
  onAskVictorStep,
  onMarkFinalAnswer,
  isCompletingSession,
  isWorkspaceLocked,
  onActiveFieldChange,
  verifyingStepId,
  isVerifying,
}: {
  steps: MathStep[];
  onAddStep: () => void;
  onVerifyAll: () => void;
  onVerifyStep: (id: string) => void;
  onUpdateStep: (id: string, latex: string, reasoning?: string) => void;
  onDeleteStep: (id: string) => void;
  onFlagForReview: (id: string) => void;
  onRequestHint?: () => void;
  onAskVictorStep?: (step: MathStep, stepNumber: number) => void;
  onMarkFinalAnswer?: (stepId: string) => void;
  isCompletingSession?: boolean;
  isWorkspaceLocked?: boolean;
  onActiveFieldChange: (field: MathfieldElement | null) => void;
  verifyingStepId: string | null;
  isVerifying: boolean;
}) {
  const t = useTranslations();
  const pendingVerifyCount = steps.filter(
    (entry) =>
      entry.status === "unchecked" || entry.status === "needs_recheck"
  ).length;
  const canVerifyAll = pendingVerifyCount >= 2 && !isWorkspaceLocked;
  const sorted = [...steps].sort((a, b) => a.step_number - b.step_number);
  const lastStepId = sorted[sorted.length - 1]?.id || null;

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-hidden px-1">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">{t("academic.mathMode.canvas.title")}</h3>
          <p className="mt-1 text-xs text-slate-600">{t("academic.mathMode.canvas.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onAddStep}
            disabled={Boolean(isWorkspaceLocked)}
            className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700"
          >
            {t("academic.mathMode.canvas.addStep")}
          </button>
          {canVerifyAll && (
            <button
              type="button"
              onClick={onVerifyAll}
              disabled={isVerifying || Boolean(isWorkspaceLocked)}
              className="rounded-full border border-emerald-500/40 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isVerifying ? t("academic.mathMode.canvas.verifying") : t("academic.mathMode.canvas.verifyAll")}
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 flex-1 min-h-0 space-y-4 overflow-y-auto pr-2">
        {steps.length === 0 && (
          <div className="border-l-2 border-slate-300 pl-4 text-sm text-slate-700">
            {t("academic.mathMode.canvas.startHere")}
            <p className="mt-2 text-slate-700">
              {t("academic.mathMode.canvas.instructions")}
            </p>
          </div>
        )}
        {steps.map((step, index) => (
          <StepRow
            key={step.id}
            step={step}
            stepNumber={index + 1}
            onUpdate={onUpdateStep}
            onVerify={onVerifyStep}
            onDelete={onDeleteStep}
            onAddStep={onAddStep}
            onFlagForReview={onFlagForReview}
            onHint={onRequestHint}
            onAskVictor={() => onAskVictorStep?.(step, index + 1)}
            onMarkFinalAnswer={onMarkFinalAnswer}
            isLastStep={step.id === lastStepId}
            isCompletingSession={isCompletingSession}
            isWorkspaceLocked={isWorkspaceLocked}
            onActiveFieldChange={onActiveFieldChange}
            isVerifying={verifyingStepId === step.id}
          />
        ))}
      </div>
    </div>
  );
}
