"use client";

export default function SetVictorDebriefOffer({
  hasRevisions,
  totalProblems,
  onOpen,
}: {
  hasRevisions: boolean;
  totalProblems: number;
  onOpen: () => void;
}) {
  return (
    <section className="space-y-2 rounded-xl border border-violet-300/30 bg-violet-500/10 p-3">
      <h4 className="text-sm font-medium text-violet-100">
        {hasRevisions
          ? "Review the full assignment with Victor"
          : "Go deeper with Victor"}
      </h4>
      <p className="text-xs text-violet-100/85">
        {hasRevisions
          ? `Walk through patterns across all ${totalProblems} problems, not just one step.`
          : "You handled this set cleanly. Victor can push you to a harder level."}
      </p>
      <button
        type="button"
        onClick={onOpen}
        className="rounded-full border border-violet-300/40 bg-violet-400/15 px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] text-violet-50"
      >
        Open Victor
      </button>
    </section>
  );
}
