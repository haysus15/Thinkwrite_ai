"use client";

import CodeSetSummaryPanel, { type CodeSetSummary } from "./CodeSetSummaryPanel";
import CodeSetVictorDebriefOffer from "./CodeSetVictorDebriefOffer";
import CodeFinalReferencePanel from "./CodeFinalReferencePanel";

type ChallengeSession = {
  id: string;
  set_order: number | null;
  victor_context: unknown;
};

export default function CodeSetCompletionPanel({
  summary,
  sessions,
  onVictorDebrief,
}: {
  summary: CodeSetSummary;
  sessions: ChallengeSession[];
  onVictorDebrief: () => void;
}) {
  return (
    <section className="space-y-3 rounded-xl border border-emerald-300/30 bg-emerald-500/10 p-4">
      <h3 className="text-sm font-semibold text-emerald-100">Challenge set complete</h3>
      <CodeSetSummaryPanel summary={summary} />
      <CodeSetVictorDebriefOffer
        revisedChallenges={summary.revised_challenges}
        totalChallenges={summary.challenges_total}
        onOpen={onVictorDebrief}
      />
      <CodeFinalReferencePanel sessions={sessions} />
    </section>
  );
}
