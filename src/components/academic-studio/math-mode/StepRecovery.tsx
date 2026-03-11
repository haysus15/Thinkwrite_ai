"use client";

type Props = {
  canUndo: boolean;
  canRevert: boolean;
  revertCount: number;
  busy?: boolean;
  onUndo: () => void;
  onRevert: () => void;
};

export default function StepRecovery({
  canUndo,
  canRevert,
  revertCount,
  busy,
  onUndo,
  onRevert,
}: Props) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={!canUndo || busy}
        onClick={onUndo}
        className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Undo last step
      </button>
      <button
        type="button"
        disabled={!canRevert || busy}
        onClick={onRevert}
        className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Revert to last verified
      </button>
      {canRevert && (
        <span className="text-xs text-slate-500">
          Removes {revertCount} step{revertCount === 1 ? "" : "s"} after your last verified step.
        </span>
      )}
    </div>
  );
}
