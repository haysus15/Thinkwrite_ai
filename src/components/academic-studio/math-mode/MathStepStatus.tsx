"use client";

import { AlertTriangle, CheckCircle2, Circle, XCircle } from "lucide-react";
import type { MathStep } from "@/types/math-mode";

const statusMeta = {
  correct: { icon: CheckCircle2, color: "text-emerald-400" },
  error: { icon: XCircle, color: "text-red-400" },
  partial: { icon: AlertTriangle, color: "text-amber-400" },
  unchecked: { icon: Circle, color: "text-slate-500" },
};

export default function MathStepStatus({ steps }: { steps: MathStep[] }) {
  return (
    <div className="space-y-2">
      {steps.length === 0 && (
        <p className="text-xs text-slate-500">No steps yet.</p>
      )}
      {steps.map((step, index) => {
        const meta = statusMeta[step.status];
        const Icon = meta.icon;
        return (
          <div key={step.id} className="flex items-center gap-2 text-xs">
            <Icon className={`h-4 w-4 ${meta.color}`} />
            <span className="text-slate-300">Step {index + 1}</span>
            {step.status === "error" && step.error_type && (
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
