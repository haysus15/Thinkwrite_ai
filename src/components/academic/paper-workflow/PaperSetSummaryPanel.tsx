"use client";

import { useTranslations } from "next-intl";

export type PaperSetSummary = {
  papers_total: number;
  clean_completions: number;
  revised_papers: number;
  total_words: number;
  time_to_complete_seconds: number;
  natural_summary: string;
};

function formatDuration(seconds: number, t: ReturnType<typeof useTranslations>): string {
  if (!seconds || seconds <= 0) return t("lessThanMinute");
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours <= 0) return t("minutes", { count: minutes });
  return t("hoursMinutes", { hours, minutes });
}

export default function PaperSetSummaryPanel({ summary }: { summary: PaperSetSummary }) {
  const t = useTranslations("academic.paperWorkflow.summary");
  return (
    <section className="space-y-3 rounded-xl border border-white/10 bg-slate-900/40 p-4">
      <h3 className="text-sm font-medium text-slate-100">{t("title")}</h3>
      <div className="grid gap-2 text-xs text-slate-300 md:grid-cols-2">
        <p>{t("papers", { count: summary.papers_total })}</p>
        <p>{t("totalWords", { count: summary.total_words.toLocaleString() })}</p>
        <p>{t("cleanCompletions", { count: summary.clean_completions })}</p>
        <p>{t("revisedPapers", { count: summary.revised_papers })}</p>
        <p>{t("completedIn", { duration: formatDuration(summary.time_to_complete_seconds, t) })}</p>
      </div>
      <p className="text-sm text-slate-200">{summary.natural_summary}</p>
    </section>
  );
}
