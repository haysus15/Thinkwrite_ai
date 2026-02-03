// src/components/academic-studio/quiz/QuizProgress.tsx
"use client";

interface QuizProgressProps {
  current: number;
  total: number;
  answered: number;
}

export default function QuizProgress({
  current,
  total,
  answered,
}: QuizProgressProps) {
  const percent = Math.round((current / total) * 100);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>
          Question {current} of {total}
        </span>
        <span>{answered} answered</span>
      </div>
      <div className="mt-3 h-2 w-full rounded-full bg-white/10">
        <div
          className="h-2 rounded-full bg-sky-400/70"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
