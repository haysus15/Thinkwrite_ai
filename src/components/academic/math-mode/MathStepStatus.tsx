"use client";

import { useTranslations } from "next-intl";
import type { MathStep } from "@/types/math-mode";
import StepStatusBadge from "./StepStatusBadge";
import AcademicEmptyState from "../shared/AcademicEmptyState";

export default function MathStepStatus({ steps }: { steps: MathStep[] }) {
  const t = useTranslations();
  return (
    <div className="space-y-2">
      {steps.length === 0 && (
        <AcademicEmptyState
          title={t("academic.mathMode.stepStatus.emptyTitle")}
          description={t("academic.mathMode.stepStatus.emptyBody")}
          className="!min-h-0 py-2"
        />
      )}
      {steps.map((step, index) => {
        return (
          <div key={step.id} className="flex items-center gap-2 text-xs">
            <StepStatusBadge status={step.status} />
            <span className="text-slate-300">{t("academic.math.stepLabel")} {index + 1}</span>
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
