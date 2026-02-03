// src/components/academic-studio/quiz/questions/MultipleChoiceQuestion.tsx
"use client";

import type { QuizQuestion } from "@/types/academic-studio";

interface MultipleChoiceQuestionProps {
  question: QuizQuestion;
  answer?: string;
  onAnswer: (value: string) => void;
}

export default function MultipleChoiceQuestion({
  question,
  answer,
  onAnswer,
}: MultipleChoiceQuestionProps) {
  return (
    <div className="space-y-4">
      <p className="text-lg font-semibold text-slate-100">{question.text}</p>
      <div className="space-y-3">
        {(question.options || []).map((option, index) => {
          const active = answer === option;
          return (
            <button
              key={`${question.id}-${index}`}
              type="button"
              onClick={() => onAnswer(option)}
              className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition ${
                active
                  ? "border-sky-400/60 bg-sky-500/15 text-slate-100"
                  : "border-white/10 bg-white/5 text-slate-300 hover:border-white/30"
              }`}
            >
              <span className="mr-2 font-semibold">
                {String.fromCharCode(65 + index)}.
              </span>
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
