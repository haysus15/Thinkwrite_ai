// src/components/academic/quiz/questions/EssayQuestion.tsx
"use client";

import { useTranslations } from "next-intl";
import type { QuizQuestion } from "@/types/academic";

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
  const t = useTranslations("academic.quizUi.questions");
  return (
    <div className="space-y-4">
      <p className="text-lg font-semibold text-slate-100">{question.text}</p>
      <p className="text-xs text-slate-500">
        {t("essayNote")}
      </p>
      <textarea
        value={answer || ""}
        onChange={(event) => onAnswer(event.target.value)}
        rows={10}
        placeholder={t("essayPlaceholder")}
        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none"
      />
    </div>
  );
}
