"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import AcademicEmptyState from "../shared/AcademicEmptyState";
import AcademicLoadingState from "../shared/AcademicLoadingState";
import AssignmentSetup from "./AssignmentSetup";

type PaperAssignmentSet = {
  id: string;
  title: string;
  class_name: string | null;
  assignment_prompt: string | null;
  rubric_text: string | null;
  paper_count: number | null;
  source_type: "manual" | "paste" | "upload";
  status: "in_progress" | "completed" | "abandoned";
  completed_at: string | null;
  created_at: string;
  updated_at: string | null;
};

type PaperRow = {
  id: string;
  assignment_set_id: string | null;
  is_complete?: boolean;
};

export default function PaperWorkflowHome() {
  const t = useTranslations("academic.paperWorkflow.home");
  const router = useRouter();
  const [sets, setSets] = useState<PaperAssignmentSet[]>([]);
  const [papers, setPapers] = useState<PaperRow[]>([]);
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
        const [setRes, papersRes] = await Promise.all([
          fetch("/api/paper/assignment-set"),
          fetch("/api/academic/papers/user"),
        ]);
        const [setData, paperData] = await Promise.all([setRes.json(), papersRes.json()]);
        if (!setRes.ok) {
          throw new Error(setData?.error || t("errors.loadSets"));
        }
        if (!papersRes.ok) {
          throw new Error(paperData?.error || t("errors.loadPapers"));
        }
        if (!active) return;
        setSets(Array.isArray(setData?.sets) ? setData.sets : []);
        setPapers(Array.isArray(paperData?.papers) ? paperData.papers : []);
      } catch (loadError) {
        if (!active) return;
        setError(
          loadError instanceof Error ? loadError.message : t("errors.loadWorkflow")
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
    const inSet = papers.filter((paper) => paper.assignment_set_id === setId);
    const complete = inSet.filter((paper) => Boolean(paper.is_complete)).length;
    return { total: inSet.length, complete };
  };

  if (loading) {
    return <AcademicLoadingState message={t("loading")} className="!min-h-0 py-4" />;
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
        <h2 className="text-lg font-medium text-slate-100">{t("title")}</h2>
        <p className="mt-1 text-sm text-slate-300">{t("subtitle")}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => router.push("/academic/paper-workflow/paper/new")}
            className="rounded-full border border-sky-300/40 bg-sky-500/15 px-3 py-1.5 text-xs text-sky-100"
          >
            {t("newPaper")}
          </button>
          <button
            type="button"
            onClick={() => setShowSetup((prev) => !prev)}
            className="rounded-full border border-sky-300/40 bg-sky-500/15 px-3 py-1.5 text-xs text-sky-100"
          >
            {t("newAssignmentSet")}
          </button>
        </div>
      </section>

      {showSetup && (
        <AssignmentSetup
          onClose={() => setShowSetup(false)}
          onCreated={(setId) => router.push(`/academic/paper-workflow/set/${setId}`)}
        />
      )}

      <section className="space-y-2 rounded-xl border border-white/10 bg-slate-900/40 p-4">
        <h3 className="text-sm font-medium text-slate-100">{t("activeSets")}</h3>
        {activeSets.length === 0 ? (
          <AcademicEmptyState
            title={t("activeSets")}
            description={t("emptyActive")}
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
                  onClick={() => router.push(`/academic/paper-workflow/set/${set.id}`)}
                  className="w-full rounded-lg border border-white/10 bg-slate-950/30 p-3 text-left hover:border-sky-300/35"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-slate-100">{set.title}</p>
                    <span className="text-[11px] text-slate-400">
                      {t("progress", {
                        complete: progress.complete,
                        total: progress.total || set.paper_count || 0,
                      })}
                    </span>
                  </div>
                  {set.class_name && (
                    <p className="mt-1 text-xs text-slate-400">{set.class_name}</p>
                  )}
                  <p className="mt-1 text-[11px] text-slate-500">
                    {t("lastWorked")}{" "}
                    {set.updated_at
                      ? new Date(set.updated_at).toLocaleString()
                      : new Date(set.created_at).toLocaleString()}
                  </p>
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
          {t("completedSets")} {showCompleted ? "▲" : "▼"}
        </button>
        {showCompleted && (
          <div className="space-y-2">
            {completedSets.length === 0 && (
              <AcademicEmptyState
                title={t("completedSets")}
                description={t("emptyCompleted")}
                className="!min-h-0 py-4"
              />
            )}
            {completedSets.map((set) => (
              <button
                key={set.id}
                type="button"
                onClick={() => router.push(`/academic/paper-workflow/set/${set.id}`)}
                className="w-full rounded-lg border border-white/10 bg-slate-950/30 p-3 text-left"
              >
                <p className="text-sm text-slate-100">{set.title}</p>
                <p className="mt-1 text-[11px] text-slate-400">
                  {t("completedOn")} {set.completed_at ? new Date(set.completed_at).toLocaleDateString() : ""}
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
