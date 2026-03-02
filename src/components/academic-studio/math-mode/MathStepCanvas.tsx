"use client";

import type { MathStep } from "@/types/math-mode";
import MathStepEditor from "./MathStepEditor";
type MathfieldElement = any;

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
    <div className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70 p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-white">Steps</h3>
          <p className="mt-1 text-xs text-slate-500">Show one transformation per step.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onAddStep}
            className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-300"
          >
            Add step
          </button>
          <button
            type="button"
            onClick={onVerifyAll}
            disabled={steps.length === 0 || isVerifying}
            className="rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-1.5 text-xs text-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isVerifying ? "Verifying..." : "Verify all"}
          </button>
        </div>
      </div>

      <div className="mt-4 flex-1 min-h-0 space-y-4 overflow-y-auto pr-2">
        {steps.length === 0 && (
          <div className="rounded-lg border border-dashed border-white/20 bg-white/[0.03] p-4 text-sm text-slate-300">
            Start here:
            <p className="mt-2 text-slate-300">
              1) Click <span className="text-white">Add step</span>.
              2) Enter one transformation.
              3) Explain the reason below it.
              4) Verify each step or run Verify all.
            </p>
          </div>
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
