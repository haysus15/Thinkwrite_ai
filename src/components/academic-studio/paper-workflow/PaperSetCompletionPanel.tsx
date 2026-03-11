"use client";

import PaperFinalReferencePanel from "./PaperFinalReferencePanel";
import PaperSetSummaryPanel, { type PaperSetSummary } from "./PaperSetSummaryPanel";
import PaperSetVictorDebriefOffer from "./PaperSetVictorDebriefOffer";

type PaperItem = {
  id: string;
  set_order: number | null;
  topic: string;
};

export default function PaperSetCompletionPanel({
  summary,
  papers,
  onVictorDebrief,
}: {
  summary: PaperSetSummary;
  papers: PaperItem[];
  onVictorDebrief: () => void;
}) {
  return (
    <div className="space-y-3">
      <PaperSetSummaryPanel summary={summary} />
      <PaperSetVictorDebriefOffer
        revisedPapers={summary.revised_papers}
        papersTotal={summary.papers_total}
        onOpen={onVictorDebrief}
      />
      <PaperFinalReferencePanel papers={papers} />
    </div>
  );
}
