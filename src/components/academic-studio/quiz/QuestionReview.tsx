// src/components/academic-studio/quiz/QuestionReview.tsx
"use client";

import type { QuizResultItem } from "@/types/academic-studio";

interface QuestionReviewProps {
  result: QuizResultItem;
}

export default function QuestionReview({ result }: QuestionReviewProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-200">
      <div className="flex items-center justify-between">
        <p className="font-semibold">Question {result.questionId}</p>
        <span
          className={`rounded-full border px-2 py-1 text-xs ${
            result.correct === true
              ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
              : result.correct === false
                ? "border-red-400/40 bg-red-500/10 text-red-200"
                : "border-white/10 bg-white/5 text-slate-400"
          }`}
        >
          {result.correct === null ? "Reviewed" : result.correct ? "Correct" : "Incorrect"}
        </span>
      </div>
      {result.feedback && (
        <p className="mt-3 text-slate-400">{result.feedback}</p>
      )}
      {result.correct === false && result.correctAnswer !== undefined && (
        <p className="mt-2 text-xs text-slate-500">
          Correct answer: {String(result.correctAnswer)}
        </p>
      )}
    </div>
  );
}
