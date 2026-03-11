"use client";

export type PaperSetSummary = {
  papers_total: number;
  clean_completions: number;
  revised_papers: number;
  total_words: number;
  time_to_complete_seconds: number;
  natural_summary: string;
};

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "Less than a minute";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours <= 0) return `${minutes} minutes`;
  return `${hours}h ${minutes}m`;
}

export default function PaperSetSummaryPanel({ summary }: { summary: PaperSetSummary }) {
  return (
    <section className="space-y-3 rounded-xl border border-white/10 bg-slate-900/40 p-4">
      <h3 className="text-sm font-medium text-slate-100">Assignment summary</h3>
      <div className="grid gap-2 text-xs text-slate-300 md:grid-cols-2">
        <p>{summary.papers_total} papers</p>
        <p>{summary.total_words.toLocaleString()} total words</p>
        <p>{summary.clean_completions} completed without revision</p>
        <p>{summary.revised_papers} revised after completion</p>
        <p>Completed in {formatDuration(summary.time_to_complete_seconds)}</p>
      </div>
      <p className="text-sm text-slate-200">{summary.natural_summary}</p>
    </section>
  );
}
