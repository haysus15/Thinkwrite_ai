"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { MathProblem, MathProblemSet } from "@/types/math-mode";
import ProblemCard from "./ProblemCard";
import SetCompletionPanel from "./SetCompletionPanel";
import type { SetSummaryData } from "./SetSummaryPanel";
import { useAuth } from "@/contexts/AuthContext";
import AcademicEmptyState from "../shared/AcademicEmptyState";
import AcademicLoadingState from "../shared/AcademicLoadingState";

export default function SetView({ setId }: { setId: string }) {
  const t = useTranslations();
  const router = useRouter();
  const { profile } = useAuth();
  const [setData, setSetData] = useState<MathProblemSet | null>(null);
  const [problems, setProblems] = useState<
    (MathProblem & {
      final_answer_preview?: string | null;
      has_activity?: boolean;
    })[]
  >([]);
  const [setSummary, setSetSummary] = useState<SetSummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingSet, setIsSavingSet] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const completedCount = useMemo(
    () => problems.filter((problem) => problem.completed).length,
    [problems]
  );
  const allComplete = problems.length > 0 && completedCount === problems.length;
  const progressPercent =
    problems.length === 0
      ? 0
      : Math.round((completedCount / problems.length) * 100);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const setResponse = await fetch(
          `/api/math/problem-set?id=${setId}&include=problems`
        );
        const setPayload = await setResponse.json();
        if (!setResponse.ok) {
          throw new Error(setPayload?.error || t("academic.mathMode.setView.errors.loadWorksheet"));
        }
        const found = (setPayload?.set as MathProblemSet) || null;
        const setProblemsList = (
          Array.isArray(setPayload?.problems)
            ? (setPayload.problems as (MathProblem & {
                final_answer_preview?: string | null;
                has_activity?: boolean;
              })[])
            : []
        )
          .sort((a, b) => Number(a.set_order || 0) - Number(b.set_order || 0));
        if (!active) return;
        setSetData(found);
        setProblems(setProblemsList);
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : t("academic.mathMode.setView.errors.loadWorksheet"));
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [setId]);

  useEffect(() => {
    let active = true;
    const loadSummary = async () => {
      if (!allComplete) {
        setSetSummary(null);
        return;
      }
      try {
        const response = await fetch("/api/math/set-summary", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            problem_set_id: setId,
            outputLanguage: profile?.preferred_language || "en",
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || t("academic.mathMode.setView.errors.loadSummary"));
        }
        if (active) setSetSummary(data as SetSummaryData);
      } catch (summaryError) {
        if (active) {
          setError(
            summaryError instanceof Error
              ? summaryError.message
              : t("academic.mathMode.setView.errors.loadSummary")
          );
        }
      }
    };
    void loadSummary();
    return () => {
      active = false;
    };
  }, [allComplete, profile?.preferred_language, setId]);

  const handleSaveSetContext = async (updates: Record<string, unknown>) => {
    setIsSavingSet(true);
    setError(null);
    try {
      const response = await fetch("/api/math/problem-set", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: setId, ...updates }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || t("academic.mathMode.setView.errors.updateWorksheet"));
      }
      setSetData(data.set as MathProblemSet);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : t("academic.mathMode.setView.errors.updateWorksheet")
      );
    } finally {
      setIsSavingSet(false);
    }
  };

  if (isLoading) {
    return (
      <AcademicLoadingState
        message={t("academic.mathMode.setView.loading")}
        className="!min-h-0 py-4"
      />
    );
  }

  if (!setData) {
    return (
      <AcademicEmptyState
        title={t("academic.mathMode.setView.notFound")}
        description={t("academic.mathMode.setView.errors.loadWorksheet")}
        className="py-6"
      />
    );
  }

  return (
    <div className="space-y-4">
      <header className="space-y-3 rounded-xl border border-white/10 bg-slate-900/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium text-slate-100">{setData.title}</h2>
            {setData.class_name && (
              <p className="text-xs text-slate-400">{setData.class_name}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => router.push("/academic/math-mode")}
            className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-slate-200"
          >
            {t("academic.mathMode.setView.backToSets")}
          </button>
        </div>

        {setData.assignment_prompt && (
          <p className="text-xs text-slate-300">{setData.assignment_prompt}</p>
        )}

        <div>
          <p className="text-xs text-slate-300">
            {t("academic.mathMode.setView.progress", { complete: completedCount, total: problems.length })}
          </p>
          <div className="mt-1 h-2 w-full rounded-full bg-slate-800">
            <div
              className="h-2 rounded-full bg-sky-400/80"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <details className="rounded border border-white/10 p-3">
          <summary className="cursor-pointer text-xs text-slate-300">
            {t("academic.mathMode.setView.assignmentDetails")}
          </summary>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <input
              defaultValue={setData.title}
              disabled={allComplete}
              onBlur={(event) =>
                event.target.value.trim() !== setData.title &&
                void handleSaveSetContext({ title: event.target.value.trim() })
              }
              className="rounded border border-white/20 bg-slate-950/30 p-2 text-sm text-slate-100"
            />
            <input
              defaultValue={setData.class_name || ""}
              disabled={allComplete}
              onBlur={(event) =>
                event.target.value !== (setData.class_name || "") &&
                void handleSaveSetContext({ class_name: event.target.value })
              }
              className="rounded border border-white/20 bg-slate-950/30 p-2 text-sm text-slate-100"
            />
            <textarea
              defaultValue={setData.assignment_prompt || ""}
              disabled={allComplete}
              onBlur={(event) =>
                event.target.value !== (setData.assignment_prompt || "") &&
                void handleSaveSetContext({ assignment_prompt: event.target.value })
              }
              rows={3}
              className="rounded border border-white/20 bg-slate-950/30 p-2 text-sm text-slate-100 md:col-span-2"
            />
          </div>
          {isSavingSet && <p className="mt-2 text-[11px] text-slate-400">{t("academic.entry.saving")}</p>}
        </details>
      </header>

      {!allComplete && (
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => {
              const target =
                problems.find((problem) => !problem.completed) || problems[0];
              if (!target) return;
              router.push(`/academic/math-mode/problem/${target.id}?setId=${setId}`);
            }}
            className="rounded-full border border-sky-300/40 bg-sky-500/15 px-3 py-1.5 text-xs text-sky-100"
          >
            {t("academic.mathMode.setView.continueWorking")}
          </button>
        </div>
      )}

      {allComplete && setSummary && (
        <SetCompletionPanel
          problems={problems}
          summary={setSummary}
          onVictorDebrief={() =>
            router.push(
              `/academic/math-mode/problem/${problems[0]?.id}?setId=${setId}&debrief=set`
            )
          }
        />
      )}

      <div className="grid gap-2">
        {problems.map((problem) => (
          <ProblemCard
            key={problem.id}
            problem={problem}
            onOpen={(selected) =>
              router.push(`/academic/math-mode/problem/${selected.id}?setId=${setId}`)
            }
          />
        ))}
      </div>

      {error && <p className="text-xs text-rose-200">{error}</p>}
    </div>
  );
}
