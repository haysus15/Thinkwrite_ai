"use client";

import { useTranslations } from "next-intl";
import { BookOpen } from "lucide-react";
import type { QuizQuestionType } from "@/types/academic";

type QuizGeneratorProps = {
  questionCount: number;
  difficulty: number;
  questionTypes: QuizQuestionType[];
  setQuestionCount: (value: number) => void;
  setDifficulty: (value: number) => void;
  toggleType: (type: QuizQuestionType) => void;
};

export default function QuizGenerator({
  questionCount,
  difficulty,
  questionTypes,
  setQuestionCount,
  setDifficulty,
  toggleType,
}: QuizGeneratorProps) {
  const t = useTranslations("academic.studyMaterials");
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="flex items-center gap-3">
        <BookOpen className="h-5 w-5 text-sky-300" />
        <p className="text-sm font-semibold text-slate-100">{t("quizConfiguration")}</p>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <label className="text-xs text-slate-400">
          {t("questions")}
          <input
            type="number"
            min={5}
            max={50}
            value={questionCount}
            onChange={(event) => setQuestionCount(Number(event.target.value))}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100"
          />
        </label>
        <label className="text-xs text-slate-400">
          {t("difficulty")}
          <input
            type="number"
            min={1}
            max={5}
            value={difficulty}
            onChange={(event) => setDifficulty(Number(event.target.value))}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100"
          />
        </label>
        <div className="text-xs text-slate-400">
          {t("types")}
          <div className="mt-2 flex flex-wrap gap-2">
            {[
              { id: "multiple_choice", label: t("typeLabels.multipleChoice") },
              { id: "true_false", label: t("typeLabels.trueFalse") },
              { id: "short_answer", label: t("typeLabels.shortAnswer") },
              { id: "essay", label: t("typeLabels.essay") },
            ].map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() => toggleType(type.id as QuizQuestionType)}
                className={`rounded-full border px-3 py-1 text-xs ${
                  questionTypes.includes(type.id as QuizQuestionType)
                    ? "border-sky-400/60 bg-sky-500/15 text-sky-200"
                    : "border-white/10 bg-white/5 text-slate-300"
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
