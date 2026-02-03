"use client";

import type { MathStep } from "@/types/math-mode";
import MathStepEditor from "./MathStepEditor";
import { MathfieldElement } from "mathlive";

export default function MathStepCanvas({
  steps,
  onAddStep,
  onVerifyAll,
  onVerifyStep,
  onUpdateStep,
  onDeleteStep,
  onActiveFieldChange,
  isVerifying,
}: {
  steps: MathStep[];
  onAddStep: () => void;
  onVerifyAll: () => void;
  onVerifyStep: (id: string) => void;
  onUpdateStep: (id: string, latex: string, reasoning?: string) => void;
  onDeleteStep: (id: string) => void;
  onActiveFieldChange: (field: MathfieldElement | null) => void;
  isVerifying: boolean;
}) {
  return (
    <div className="glass-panel flex flex-1 min-h-0 flex-col overflow-hidden p-6">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-semibold text-white">Your work</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onAddStep}
            className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs text-slate-300"
          >
            Add step
          </button>
          <button
            type="button"
            onClick={onVerifyAll}
            disabled={steps.length === 0 || isVerifying}
            className="rounded-full border border-emerald-400/40 bg-emerald-500/15 px-4 py-1.5 text-xs text-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isVerifying ? "Verifying..." : "Verify all"}
          </button>
        </div>
      </div>

      <div className="mt-4 flex-1 min-h-0 space-y-4 overflow-y-auto pr-2">
        {steps.length === 0 && (
          <p className="text-sm text-slate-400">
            Add your first step to begin the verification.
          </p>
        )}
        {steps.map((step, index) => (
          <MathStepEditor
            key={step.id}
            step={step}
            stepNumber={index + 1}
            onUpdate={onUpdateStep}
            onVerify={onVerifyStep}
            onDelete={onDeleteStep}
            onActiveFieldChange={onActiveFieldChange}
          />
        ))}
      </div>
    </div>
  );
}
