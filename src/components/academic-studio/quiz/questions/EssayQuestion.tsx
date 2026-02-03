// src/components/academic-studio/quiz/questions/EssayQuestion.tsx
"use client";

import type { QuizQuestion } from "@/types/academic-studio";

interface EssayQuestionProps {
  question: QuizQuestion;
  answer?: string;
  onAnswer: (value: string) => void;
}

export default function EssayQuestion({
  question,
  answer,
  onAnswer,
}: EssayQuestionProps) {
  return (
    <div className="space-y-4">
      <p className="text-lg font-semibold text-slate-100">{question.text}</p>
      <p className="text-xs text-slate-500">
        Victor will review your essay response.
      </p>
      <textarea
        value={answer || ""}
        onChange={(event) => onAnswer(event.target.value)}
        rows={10}
        placeholder="Write your response."
        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none"
      />
    </div>
  );
}
