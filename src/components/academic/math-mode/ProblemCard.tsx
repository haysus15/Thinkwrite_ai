"use client";

import { useTranslations } from "next-intl";
import type { MathProblem } from "@/types/math-mode";

function getStatus(problem: MathProblem): "not_started" | "in_progress" | "complete" {
  if (problem.completed) return "complete";
  const withActivity = problem as MathProblem & { has_activity?: boolean };
  if (!withActivity.has_activity) return "not_started";
  return "in_progress";
}

export default function ProblemCard({
  problem,
  onOpen,
}: {
  problem: MathProblem & {
    final_answer_preview?: string | null;
    has_activity?: boolean;
  };
  onOpen: (problem: MathProblem) => void;
}) {
  const t = useTranslations();
  const status = getStatus(problem);
  const statusLabel =
    status === "complete"
      ? t("academic.mathMode.problemCard.complete")
      : status === "in_progress"
      ? t("academic.mathMode.problemCard.inProgress")
      : t("academic.mathMode.problemCard.notStarted");
  const statusClasses =
    status === "complete"
      ? "border-emerald-300/40 bg-emerald-500/10 text-emerald-100"
      : status === "in_progress"
      ? "border-amber-300/40 bg-amber-500/10 text-amber-100"
      : "border-slate-300/30 bg-slate-500/10 text-slate-200";

  return (
    <button
      type="button"
      onClick={() => onOpen(problem)}
      className="w-full rounded-xl border border-white/10 bg-slate-900/40 p-3 text-left transition hover:border-sky-300/40 hover:bg-sky-500/10"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-100">
          {t("academic.entry.problem")} {problem.set_order || "?"}
        </p>
        <span className={`rounded-full border px-2 py-0.5 text-[11px] ${statusClasses}`}>
          {statusLabel}
        </span>
      </div>
      <p className="mt-2 line-clamp-2 text-xs text-slate-300">
        {problem.plain_text || problem.latex}
      </p>
      {problem.completed && (
        <p className="mt-2 text-[11px] text-emerald-200">
          {t("academic.mathMode.problemCard.finalAnswer")}: {problem.final_answer_preview || t("academic.mathMode.problemCard.recorded")}
        </p>
      )}
    </button>
  );
}
