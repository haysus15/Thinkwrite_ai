"use client";

import { Bot, LineChart } from "lucide-react";
import { useTranslations } from "next-intl";

export default function MathModeHeader({
  hasProblem,
  stepCount,
  mathTrack,
  onTrackChange,
  breadcrumbLabel,
  onBreadcrumbClick,
}: {
  hasProblem: boolean;
  stepCount: number;
  mathTrack: "general" | "algebra" | "calculus" | "statistics";
  onTrackChange: (track: "general" | "algebra" | "calculus" | "statistics") => void;
  breadcrumbLabel?: string | null;
  onBreadcrumbClick?: () => void;
}) {
  const t = useTranslations();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-300 px-4 py-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <h2 className="text-base font-semibold text-slate-900">{t("academic.mathMode.header.worksheet")}</h2>
        <span className="text-xs text-slate-500">
          {hasProblem ? t("academic.mathMode.header.problemInProgress") : t("academic.mathMode.header.problemTitlePlaceholder")}
        </span>
        <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-slate-600">
          {hasProblem ? t("academic.mathMode.header.active") : t("academic.mathMode.header.draft")}
        </span>
        <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-slate-600">
          {t("academic.mathMode.header.stepCount", { count: stepCount })}
        </span>
        {breadcrumbLabel && (
          <button
            type="button"
            onClick={onBreadcrumbClick}
            className="rounded-full border border-sky-300/40 bg-sky-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-sky-100"
          >
            {breadcrumbLabel}
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-500">
          <Bot className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="sr-only">{t("academic.mathMode.header.victor")}</span>
        </span>
        <span className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-500">
          <LineChart className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="sr-only">{t("academic.mathMode.header.graph")}</span>
        </span>
        <select
          value={mathTrack}
          onChange={(event) =>
            onTrackChange(
              event.target.value as
                | "general"
                | "algebra"
                | "calculus"
                | "statistics"
            )
          }
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700"
        >
          <option value="general">{t("academic.mathMode.header.tracks.general")}</option>
          <option value="algebra">{t("academic.mathMode.header.tracks.algebra")}</option>
          <option value="calculus">{t("academic.mathMode.header.tracks.calculus")}</option>
          <option value="statistics">{t("academic.mathMode.header.tracks.statistics")}</option>
        </select>
      </div>
    </div>
  );
}
