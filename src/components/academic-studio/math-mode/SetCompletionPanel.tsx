"use client";

import type { MathProblem } from "@/types/math-mode";
import FinalAnswersReference from "./FinalAnswersReference";
import SetSummaryPanel, { type SetSummaryData } from "./SetSummaryPanel";
import SetVictorDebriefOffer from "./SetVictorDebriefOffer";

export default function SetCompletionPanel({
  problems,
  summary,
  onVictorDebrief,
}: {
  problems: MathProblem[];
  summary: SetSummaryData;
  onVictorDebrief: () => void;
}) {
  return (
    <section className="space-y-3">
      <div className="rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
        Worksheet complete.
      </div>
      <SetSummaryPanel totalProblems={problems.length} summary={summary} />
      <SetVictorDebriefOffer
        totalProblems={problems.length}
        hasRevisions={summary.revised_problems > 0}
        onOpen={onVictorDebrief}
      />
      <FinalAnswersReference problems={problems} />
    </section>
  );
}
