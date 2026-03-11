"use client";

import type { MathStep } from "@/types/math-mode";
import StepStatusBadge from "./StepStatusBadge";
import AcademicEmptyState from "../shared/AcademicEmptyState";

export default function MathStepStatus({ steps }: { steps: MathStep[] }) {
  return (
    <div className="space-y-2">
      {steps.length === 0 && (
        <AcademicEmptyState
          title="No steps yet"
          description="Add your first step to begin verification."
          className="!min-h-0 py-2"
        />
      )}
      {steps.map((step, index) => {
        return (
          <div key={step.id} className="flex items-center gap-2 text-xs">
            <StepStatusBadge status={step.status} />
            <span className="text-slate-300">Step {index + 1}</span>
            {(step.status === "error" || step.status === "incorrect") &&
              step.error_type && (
              <span className="text-red-400 text-[10px]">
                {step.error_type}
              </span>
              )}
          </div>
        );
      })}
    </div>
  );
}
