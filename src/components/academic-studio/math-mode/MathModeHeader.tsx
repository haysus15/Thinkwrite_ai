"use client";

import { Bot, LineChart } from "lucide-react";

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
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-300 px-4 py-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <h2 className="text-base font-semibold text-slate-900">Worksheet</h2>
        <span className="text-xs text-slate-500">
          {hasProblem ? "Problem in progress" : "Problem title will appear here"}
        </span>
        <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-slate-600">
          {hasProblem ? "Active" : "Draft"}
        </span>
        <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-slate-600">
          {stepCount} step{stepCount === 1 ? "" : "s"}
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
          <span className="sr-only">Victor</span>
        </span>
        <span className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-500">
          <LineChart className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="sr-only">Graph</span>
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
          <option value="general">General</option>
          <option value="algebra">Algebra</option>
          <option value="calculus">Calculus</option>
          <option value="statistics">Statistics</option>
        </select>
      </div>
    </div>
  );
}
