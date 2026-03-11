"use client";

export type SetSummaryData = {
  steps_total: number;
  clean_solves: number;
  revised_problems: number;
  hints_used: number;
  total_time_seconds: number;
  concepts: Array<{ tag: string; display_name: string; mastery_level: number }>;
  hardest_problem: { id: string; set_order: number; latex: string; revisions: number } | null;
  natural_summary: string;
};

function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.round(Number(seconds || 0)));
  const minutes = Math.floor(safe / 60);
  const rem = safe % 60;
  if (minutes <= 0) return `${rem}s`;
  if (rem === 0) return `${minutes}m`;
  return `${minutes}m ${rem}s`;
}

export default function SetSummaryPanel({
  totalProblems,
  summary,
}: {
  totalProblems: number;
  summary: SetSummaryData;
}) {
  return (
    <section className="space-y-3 rounded-xl border border-white/10 bg-slate-900/40 p-4">
      <p className="text-sm text-slate-100">{totalProblems} problems</p>
      <p className="text-xs text-slate-300">{summary.clean_solves} solved cleanly</p>
      <p className="text-xs text-slate-300">{summary.revised_problems} needed revision</p>
      {summary.hints_used > 0 && (
        <p className="text-xs text-slate-300">{summary.hints_used} hints used</p>
      )}
      <p className="text-xs text-slate-300">
        Worked for {formatDuration(summary.total_time_seconds)}
      </p>
      {summary.hardest_problem && (
        <p className="text-xs text-amber-200">
          Problem {summary.hardest_problem.set_order} took the most work
        </p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {summary.concepts.map((concept) => (
          <span
            key={concept.tag}
            className="rounded-full border border-sky-300/30 bg-sky-500/10 px-2 py-0.5 text-[11px] text-sky-100"
          >
            {concept.display_name}
          </span>
        ))}
      </div>
      <p className="text-sm text-slate-200">{summary.natural_summary}</p>
    </section>
  );
}
