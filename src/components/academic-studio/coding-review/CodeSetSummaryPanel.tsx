"use client";

export type CodeSetSummary = {
  challenges_total: number;
  clean_completions: number;
  revised_challenges: number;
  languages: string[];
  challenge_types: string[];
  time_to_complete_seconds: number;
  natural_summary: string;
};

export default function CodeSetSummaryPanel({ summary }: { summary: CodeSetSummary }) {
  return (
    <section className="space-y-3 rounded-xl border border-white/10 bg-slate-900/40 p-4">
      <h3 className="text-sm font-semibold text-slate-100">Set summary</h3>
      <div className="grid gap-2 text-xs text-slate-300 md:grid-cols-2">
        <p>{summary.challenges_total} challenges</p>
        <p>{summary.clean_completions} completed without revision</p>
        <p>{summary.revised_challenges} revised after initial completion</p>
        <p>Worked for {Math.round(summary.time_to_complete_seconds / 60)} minutes</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
        <span className="text-slate-400">Languages:</span>
        {(summary.languages.length ? summary.languages : ["Not specified"]).map((language) => (
          <span key={language} className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5">
            {language}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
        <span className="text-slate-400">Challenge types:</span>
        {(summary.challenge_types.length ? summary.challenge_types : ["other"]).map((type) => (
          <span key={type} className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5">
            {type}
          </span>
        ))}
      </div>
      <p className="text-xs text-slate-200">{summary.natural_summary}</p>
    </section>
  );
}
