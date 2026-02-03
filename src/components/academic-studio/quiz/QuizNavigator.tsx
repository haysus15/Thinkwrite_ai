// src/components/academic-studio/quiz/QuizNavigator.tsx
"use client";

interface QuizNavigatorProps {
  currentIndex: number;
  total: number;
  onPrevious: () => void;
  onNext: () => void;
  onSubmit: () => void;
  submitting: boolean;
  canSubmit: boolean;
}

export default function QuizNavigator({
  currentIndex,
  total,
  onPrevious,
  onNext,
  onSubmit,
  submitting,
  canSubmit,
}: QuizNavigatorProps) {
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === total - 1;

  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
      <button
        type="button"
        onClick={onPrevious}
        disabled={isFirst}
        className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Previous
      </button>
      {!isLast && (
        <button
          type="button"
          onClick={onNext}
          className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300"
        >
          Next
        </button>
      )}
      {isLast && (
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit || submitting}
          className="rounded-full border border-sky-400/50 bg-sky-500/15 px-5 py-2 text-sm text-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "Submit quiz"}
        </button>
      )}
    </div>
  );
}
