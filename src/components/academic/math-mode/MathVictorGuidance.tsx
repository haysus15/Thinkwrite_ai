"use client";

import { useTranslations } from "next-intl";
import type { MathGuidance, MathStep } from "@/types/math-mode";
import MathStepStatus from "./MathStepStatus";

export default function MathVictorGuidance({
  guidance,
  steps,
}: {
  guidance: MathGuidance[];
  steps: MathStep[];
}) {
  const t = useTranslations();
  const currentGuidance = guidance[guidance.length - 1]?.message;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-sky-400/30 bg-sky-500/15 text-sm font-semibold text-sky-200">
          V
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{t("academic.mathMode.guidance.victor")}</p>
          <p className="text-xs text-slate-500">{t("academic.mathMode.guidance.stepGuidance")}</p>
        </div>
      </div>

      <div className="rounded-lg border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-sm text-slate-200">
        {currentGuidance ||
          t("academic.mathMode.guidance.default")}
      </div>

      <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-300">
        {t("academic.mathMode.guidance.workflow")}
      </div>

      <div>
        <h4 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          {t("academic.mathMode.guidance.stepStatus")}
        </h4>
        <div className="mt-2">
          <MathStepStatus steps={steps} />
        </div>
      </div>

      <details className="mt-auto text-sm text-slate-300">
        <summary className="cursor-pointer text-xs uppercase tracking-[0.3em] text-slate-500">
          {t("academic.mathMode.guidance.refresher")}
        </summary>
        <div className="mt-2 text-sm text-slate-300">
          {t("academic.mathMode.guidance.refresherBody")}
        </div>
      </details>
    </div>
  );
}
