"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { MathProblem, MathProblemSet } from "@/types/math-mode";
import AcademicEmptyState from "../shared/AcademicEmptyState";
import AcademicLoadingState from "../shared/AcademicLoadingState";
import WorksheetSetup from "./WorksheetSetup";

export default function MathModeHome() {
  const t = useTranslations();
  const router = useRouter();
  const [sets, setSets] = useState<MathProblemSet[]>([]);
  const [problems, setProblems] = useState<MathProblem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeSets = useMemo(
    () => sets.filter((set) => set.status !== "completed"),
    [sets]
  );
  const completedSets = useMemo(
    () => sets.filter((set) => set.status === "completed"),
    [sets]
  );

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [setsRes, probsRes] = await Promise.all([
          fetch("/api/math/problem-set"),
          fetch("/api/math/problem"),
        ]);
        const [setsData, probsData] = await Promise.all([
          setsRes.json(),
          probsRes.json(),
        ]);
        if (!setsRes.ok) {
          throw new Error(setsData?.error || t("academic.entry.errors.loadProblemSets"));
        }
        if (!probsRes.ok) {
          throw new Error(probsData?.error || t("academic.entry.errors.loadProblems"));
        }
        if (!active) return;
        setSets(Array.isArray(setsData?.sets) ? setsData.sets : []);
        setProblems(Array.isArray(probsData?.problems) ? probsData.problems : []);
      } catch (loadError) {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : t("academic.entry.errors.loadMathMode")
        );
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const getProgress = (setId: string) => {
    const setProblems = problems.filter((problem) => problem.problem_set_id === setId);
    const complete = setProblems.filter((problem) => problem.completed).length;
    return { total: setProblems.length, complete };
  };

  if (loading) {
    return (
      <AcademicLoadingState
        message={t("academic.entry.loadingMathMode")}
        className="!min-h-0 py-4"
      />
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
        <h2 className="text-lg font-medium text-slate-100">{t("academic.math.title")}</h2>
        <p className="mt-1 text-sm text-slate-300">{t("academic.entry.mathHomePrompt")}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => router.push("/academic/math-mode/problem/new")}
            className="rounded-full border border-sky-300/40 bg-sky-500/15 px-3 py-1.5 text-xs text-sky-100"
          >
            {t("academic.entry.newProblem")}
          </button>
          <button
            type="button"
            onClick={() => setShowSetup((prev) => !prev)}
            className="rounded-full border border-sky-300/40 bg-sky-500/15 px-3 py-1.5 text-xs text-sky-100"
          >
            {t("academic.entry.newWorksheet")}
          </button>
        </div>
      </section>

      {showSetup && (
        <WorksheetSetup
          onClose={() => setShowSetup(false)}
          onCreated={(setId) => router.push(`/academic/math-mode/set/${setId}`)}
        />
      )}

      <section className="space-y-2 rounded-xl border border-white/10 bg-slate-900/40 p-4">
        <h3 className="text-sm font-medium text-slate-100">{t("academic.entry.activeSets")}</h3>
        {activeSets.length === 0 ? (
          <AcademicEmptyState
            title={t("academic.entry.activeSets")}
            description={t("academic.entry.noActiveWorksheets")}
            className="!min-h-0 py-4"
          />
        ) : (
          <div className="space-y-2">
            {activeSets.map((set) => {
              const progress = getProgress(set.id);
              return (
                <button
                  key={set.id}
                  type="button"
                  onClick={() => router.push(`/academic/math-mode/set/${set.id}`)}
                  className="w-full rounded-lg border border-white/10 bg-slate-950/30 p-3 text-left hover:border-sky-300/35"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-slate-100">{set.title}</p>
                    <span className="text-[11px] text-slate-400">
                      {progress.complete} {t("academic.entry.of")} {progress.total || set.problem_count || 0} {t("academic.entry.complete")}
                    </span>
                  </div>
                  {set.class_name && (
                    <p className="mt-1 text-xs text-slate-400">{set.class_name}</p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-2 rounded-xl border border-white/10 bg-slate-900/40 p-4">
        <button
          type="button"
          onClick={() => setShowCompleted((prev) => !prev)}
          className="text-sm font-medium text-slate-100"
        >
          {t("academic.entry.completedSets")} {showCompleted ? "▲" : "▼"}
        </button>
        {showCompleted && (
          <div className="space-y-2">
            {completedSets.length === 0 && (
              <p className="text-xs text-slate-400">{t("academic.entry.noCompletedWorksheets")}</p>
            )}
            {completedSets.map((set) => (
              <button
                key={set.id}
                type="button"
                onClick={() => router.push(`/academic/math-mode/set/${set.id}`)}
                className="w-full rounded-lg border border-white/10 bg-slate-950/30 p-3 text-left"
              >
                <p className="text-sm text-slate-100">{set.title}</p>
                <p className="mt-1 text-[11px] text-slate-400">
                  {t("academic.entry.completedOn")} {set.completed_at ? new Date(set.completed_at).toLocaleDateString() : ""}
                </p>
              </button>
            ))}
          </div>
        )}
      </section>

      {error && <p className="text-xs text-rose-200">{error}</p>}
    </div>
  );
}
