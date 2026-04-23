"use client";

import type { MathSessionSummary } from "@/types/math-mode";
import MasteryBar from "./MasteryBar";

function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.round(Number(seconds || 0)));
  const minutes = Math.floor(safe / 60);
  const rem = safe % 60;
  if (minutes <= 0) return `${rem}s`;
  if (rem === 0) return `${minutes}m`;
  return `${minutes}m ${rem}s`;
}

export default function SessionSummary({
  problemLatex,
  summary,
}: {
  problemLatex: string;
  summary: MathSessionSummary;
}) {
  return (
    <section className="space-y-4 rounded-xl border border-white/10 bg-slate-900/40 p-4">
      <header className="space-y-2">
        <p className="line-clamp-2 text-sm text-slate-100">{problemLatex}</p>
        <p className="text-xs text-slate-400">
          {summary.steps_total} steps · {formatDuration(summary.completion_time_seconds)}
        </p>
      </header>

      <div className="space-y-1 text-xs text-slate-300">
        <p>
          {summary.steps_correct_first_try} of {summary.steps_total} steps correct on first attempt
        </p>
        <p>{summary.steps_revised} steps revised</p>
        {summary.hints_used > 0 && <p>{summary.hints_used} hints used</p>}
      </div>

      {summary.concepts.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-medium uppercase tracking-[0.1em] text-slate-400">
            Concepts used
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {summary.concepts.map((concept) => (
              <span
                key={concept.tag}
                className="rounded-full border border-sky-300/30 bg-sky-500/10 px-2.5 py-1 text-[11px] text-sky-100"
              >
                {concept.display_name}
              </span>
            ))}
          </div>
          <div className="space-y-3">
            {summary.concepts.map((concept) => (
              <MasteryBar
                key={`mastery-${concept.tag}`}
                label={concept.display_name}
                value={concept.mastery_level}
              />
            ))}
          </div>
        </div>
      )}

      <p className="text-sm text-slate-200">{summary.natural_summary}</p>
    </section>
  );
}
