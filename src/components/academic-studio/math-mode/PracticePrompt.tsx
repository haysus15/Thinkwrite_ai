"use client";

export default function PracticePrompt({
  visible,
  conceptLabel,
  onGenerate,
  onDismiss,
  isLoading = false,
  isDismissed = false,
}: {
  visible: boolean;
  conceptLabel: string;
  onGenerate: () => void;
  onDismiss: () => void;
  isLoading?: boolean;
  isDismissed?: boolean;
}) {
  if (!visible || isDismissed) return null;

  return (
    <section className="space-y-3 rounded-xl border border-amber-300/30 bg-amber-500/10 px-3 py-3">
      <h4 className="text-sm font-medium text-amber-100">
        Want to strengthen the weak spots?
      </h4>
      <p className="text-xs text-amber-100/90">
        You had difficulty with {conceptLabel} in this problem.
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={isLoading}
          onClick={onGenerate}
          className="rounded-full border border-amber-300/40 bg-amber-400/15 px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] text-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "Generating..." : "Generate practice problems"}
        </button>
        <button
          type="button"
          disabled={isLoading}
          onClick={onDismiss}
          className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] text-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Not now
        </button>
      </div>
    </section>
  );
}
