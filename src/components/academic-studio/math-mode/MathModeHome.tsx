"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { MathProblem, MathProblemSet } from "@/types/math-mode";
import WorksheetSetup from "./WorksheetSetup";

export default function MathModeHome() {
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
          throw new Error(setsData?.error || "Unable to load problem sets.");
        }
        if (!probsRes.ok) {
          throw new Error(probsData?.error || "Unable to load problems.");
        }
        if (!active) return;
        setSets(Array.isArray(setsData?.sets) ? setsData.sets : []);
        setProblems(Array.isArray(probsData?.problems) ? probsData.problems : []);
      } catch (loadError) {
        if (!active) return;
        setError(
          loadError instanceof Error ? loadError.message : "Unable to load math mode."
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
    return <p className="text-sm text-slate-300">Loading math mode...</p>;
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
        <h2 className="text-lg font-medium text-slate-100">Math Mode</h2>
        <p className="mt-1 text-sm text-slate-300">What are you working on today?</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => router.push("/academic/math-mode/problem/new")}
            className="rounded-full border border-sky-300/40 bg-sky-500/15 px-3 py-1.5 text-xs text-sky-100"
          >
            New problem
          </button>
          <button
            type="button"
            onClick={() => setShowSetup((prev) => !prev)}
            className="rounded-full border border-sky-300/40 bg-sky-500/15 px-3 py-1.5 text-xs text-sky-100"
          >
            New worksheet
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
        <h3 className="text-sm font-medium text-slate-100">Active sets</h3>
        {activeSets.length === 0 ? (
          <p className="text-xs text-slate-400">No active worksheets yet.</p>
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
                      {progress.complete} of {progress.total || set.problem_count || 0} complete
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
          Completed sets {showCompleted ? "▲" : "▼"}
        </button>
        {showCompleted && (
          <div className="space-y-2">
            {completedSets.length === 0 && (
              <p className="text-xs text-slate-400">No completed worksheets yet.</p>
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
                  Completed {set.completed_at ? new Date(set.completed_at).toLocaleDateString() : ""}
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
