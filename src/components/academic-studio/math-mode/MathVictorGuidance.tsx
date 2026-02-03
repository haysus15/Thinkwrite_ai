"use client";

import type { MathGuidance, MathStep } from "@/types/math-mode";
import MathStepStatus from "./MathStepStatus";

export default function MathVictorGuidance({
  guidance,
  steps,
}: {
  guidance: MathGuidance[];
  steps: MathStep[];
}) {
  const currentGuidance = guidance[guidance.length - 1]?.message;

  return (
    <div className="glass-panel flex flex-col gap-4 p-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full border border-sky-400/30 bg-sky-500/20 text-sky-200 flex items-center justify-center text-sm font-semibold">
          V
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Victor</p>
          <p className="text-xs text-slate-400">Guiding your work</p>
        </div>
      </div>

      <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-sm text-slate-200">
        {currentGuidance ||
          "State the problem and show your first step. I will check each move."}
      </div>

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
          Step status
        </h4>
        <div className="mt-3">
          <MathStepStatus steps={steps} />
        </div>
      </div>

      <details className="mt-auto text-sm text-slate-300">
        <summary className="cursor-pointer text-xs uppercase tracking-[0.3em] text-slate-400">
          Need a concept refresher?
        </summary>
        <div className="mt-2 text-sm text-slate-300">
          Focus on the rule that justifies the transformation you are making.
        </div>
      </details>
    </div>
  );
}
