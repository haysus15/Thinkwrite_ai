"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { MathProblem, MathProblemSet } from "@/types/math-mode";
import ProblemCard from "./ProblemCard";
import SetCompletionPanel from "./SetCompletionPanel";
import type { SetSummaryData } from "./SetSummaryPanel";

export default function SetView({ setId }: { setId: string }) {
  const router = useRouter();
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
          throw new Error(setPayload?.error || "Unable to load worksheet.");
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
        setError(loadError instanceof Error ? loadError.message : "Unable to load worksheet.");
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
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ problem_set_id: setId }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || "Unable to load set summary.");
        }
        if (active) setSetSummary(data as SetSummaryData);
      } catch (summaryError) {
        if (active) {
          setError(
            summaryError instanceof Error
              ? summaryError.message
              : "Unable to load set summary."
          );
        }
      }
    };
    void loadSummary();
    return () => {
      active = false;
    };
  }, [allComplete, setId]);

  const handleSaveSetContext = async (updates: Record<string, unknown>) => {
    setIsSavingSet(true);
    setError(null);
    try {
      const response = await fetch("/api/math/problem-set", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: setId, ...updates }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Unable to update worksheet details.");
      }
      setSetData(data.set as MathProblemSet);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to update worksheet details."
      );
    } finally {
      setIsSavingSet(false);
    }
  };

  if (isLoading) {
    return <p className="text-sm text-slate-300">Loading worksheet...</p>;
  }

  if (!setData) {
    return <p className="text-sm text-rose-200">Worksheet not found.</p>;
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
            Back to sets
          </button>
        </div>

        {setData.assignment_prompt && (
          <p className="text-xs text-slate-300">{setData.assignment_prompt}</p>
        )}

        <div>
          <p className="text-xs text-slate-300">
            {completedCount} of {problems.length} problems complete
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
            Assignment details
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
          {isSavingSet && <p className="mt-2 text-[11px] text-slate-400">Saving…</p>}
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
            Continue working
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
