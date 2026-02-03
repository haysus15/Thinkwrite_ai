// src/components/academic-studio/quiz/questions/TrueFalseQuestion.tsx
"use client";

import type { QuizQuestion } from "@/types/academic-studio";

interface TrueFalseQuestionProps {
  question: QuizQuestion;
  answer?: boolean;
  onAnswer: (value: boolean) => void;
}

export default function TrueFalseQuestion({
  question,
  answer,
  onAnswer,
}: TrueFalseQuestionProps) {
  return (
    <div className="space-y-4">
      <p className="text-lg font-semibold text-slate-100">{question.text}</p>
      <div className="grid grid-cols-2 gap-4">
        {[true, false].map((value) => {
          const active = answer === value;
          return (
            <button
              key={String(value)}
              type="button"
              onClick={() => onAnswer(value)}
              className={`rounded-2xl border px-4 py-4 text-sm transition ${
                active
                  ? "border-sky-400/60 bg-sky-500/15 text-slate-100"
                  : "border-white/10 bg-white/5 text-slate-300 hover:border-white/30"
              }`}
            >
              {value ? "True" : "False"}
            </button>
          );
        })}
      </div>
    </div>
  );
}
