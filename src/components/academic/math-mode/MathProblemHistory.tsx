"use client";

import { useTranslations } from "next-intl";
import type { MathProblem } from "@/types/math-mode";
import AcademicEmptyState from "../shared/AcademicEmptyState";

export default function MathProblemHistory({
  problems,
  onSelect,
}: {
  problems: MathProblem[];
  onSelect: (id: string) => void;
}) {
  const t = useTranslations();
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
      <h4 className="text-sm font-semibold text-white">{t("academic.mathMode.history.title")}</h4>
      <div className="mt-3 space-y-2 text-xs text-slate-300">
        {problems.length === 0 && (
          <AcademicEmptyState
            title={t("academic.mathMode.history.emptyTitle")}
            description={t("academic.mathMode.history.emptyBody")}
            className="!min-h-0 py-2"
          />
        )}
        {problems.map((problem) => (
          <button
            key={problem.id}
            type="button"
            onClick={() => onSelect(problem.id)}
            className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-left transition hover:bg-white/[0.08]"
          >
            <p className="text-slate-100">{problem.latex || t("academic.mathMode.history.untitled")}</p>
            <p className="mt-1 text-[10px] text-slate-500">
              {new Date(problem.created_at).toLocaleDateString()}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
