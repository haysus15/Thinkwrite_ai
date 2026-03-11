"use client";

export default function CodeSetVictorDebriefOffer({
  revisedChallenges,
  totalChallenges,
  onOpen,
}: {
  revisedChallenges: number;
  totalChallenges: number;
  onOpen: () => void;
}) {
  const hasRevisions = revisedChallenges > 0;

  return (
    <section className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
      <p className="text-sm font-medium text-slate-100">
        {hasRevisions ? "Review the full assignment with Victor" : "Go deeper with Victor"}
      </p>
      <p className="mt-1 text-xs text-slate-300">
        {hasRevisions
          ? `Walk through the patterns across all ${totalChallenges} challenges and what they reveal about your approach.`
          : "You completed everything. Victor can push your solutions further or introduce a harder variation."}
      </p>
      <button
        type="button"
        onClick={onOpen}
        className="mt-3 rounded-full border border-violet-300/40 bg-violet-500/15 px-3 py-1.5 text-xs text-violet-100"
      >
        Open Victor debrief
      </button>
    </section>
  );
}
