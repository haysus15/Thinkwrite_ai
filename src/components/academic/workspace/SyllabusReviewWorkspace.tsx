"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toDateInputValue } from "@/lib/academic/dueDate";
import AcademicEmptyState from "../shared/AcademicEmptyState";
import AcademicErrorState from "../shared/AcademicErrorState";
import AcademicLoadingState from "../shared/AcademicLoadingState";
import SyllabusPublishPreviewModal from "./SyllabusPublishPreviewModal";

type DraftRow = {
  id: string;
  class_name: string;
  assignment_name: string;
  assignment_type: string | null;
  due_date: string | null;
  grading_weight: number | null;
  draft_status: "parsed" | "edited" | "approved" | "rejected" | "published";
  parser_confidence: number | null;
};

type SyllabusPayload = {
  id: string;
  class_name: string;
  status: string | null;
  uploaded_at: string | null;
  confirmed: boolean;
  parse_confidence?: number | null;
};

type EditableDraft = {
  id: string;
  class_name: string;
  assignment_name: string;
  assignment_type: string;
  due_date: string;
  grading_weight: string;
  approved: boolean;
  parser_confidence: number;
};

type SyllabusReviewWorkspaceProps = {
  syllabusIdOverride?: string | null;
  embedded?: boolean;
  onPublished?: (syllabusId: string) => void;
};

function confidencePct(value: number | null | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  const normalized = value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, Math.round(normalized)));
}

function confidenceClass(pct: number): string {
  if (pct >= 90) return "border-emerald-300/35 bg-emerald-500/15 text-emerald-100";
  if (pct >= 70) return "border-amber-300/35 bg-amber-500/15 text-amber-100";
  return "border-red-300/35 bg-red-500/15 text-red-100";
}

function weekStart(dateKey: string): string | null {
  if (!dateKey) return null;
  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay());
  const year = start.getFullYear();
  const month = String(start.getMonth() + 1).padStart(2, "0");
  const day = String(start.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function SyllabusReviewWorkspace({
  syllabusIdOverride = null,
  embedded = false,
  onPublished,
}: SyllabusReviewWorkspaceProps = {}) {
  const t = useTranslations("academic.workspace.syllabusReview");
  const router = useRouter();
  const searchParams = useSearchParams();
  const syllabusId = syllabusIdOverride ?? searchParams.get("syllabus");

  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [savingDrafts, setSavingDrafts] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPublishPreview, setShowPublishPreview] = useState(false);
  const [syllabus, setSyllabus] = useState<SyllabusPayload | null>(null);
  const [drafts, setDrafts] = useState<EditableDraft[]>([]);
  const [rowExpandedById, setRowExpandedById] = useState<Record<string, boolean>>({});

  const resolveLatestSyllabusId = useCallback(async () => {
    const latestResponse = await fetch("/api/travis/syllabus/latest");
    const latestData = await latestResponse.json();
    if (!latestResponse.ok) {
      throw new Error(latestData.error || t("errors.loadLatest"));
    }
    return (latestData?.syllabus?.id as string | undefined) ?? null;
  }, []);

  const loadReview = useCallback(async () => {
    let targetSyllabusId: string | null = syllabusId;
    if (!targetSyllabusId) {
      targetSyllabusId = await resolveLatestSyllabusId();
      if (!targetSyllabusId) return;
      if (!embedded) {
        router.replace(`/academic/syllabi?syllabus=${targetSyllabusId}`);
      }
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/travis/syllabus/${targetSyllabusId}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || t("errors.loadReview"));
      }

      setSyllabus(data.syllabus as SyllabusPayload);
      const rows = (data.drafts || []) as DraftRow[];
      const mapped = rows.map((row) => ({
        id: row.id,
        class_name: row.class_name || data.syllabus?.class_name || "",
        assignment_name: row.assignment_name || "",
        assignment_type: row.assignment_type || "",
        due_date: toDateInputValue(row.due_date),
        grading_weight:
          typeof row.grading_weight === "number" ? String(row.grading_weight) : "",
        approved: row.draft_status !== "rejected",
        parser_confidence: confidencePct(row.parser_confidence),
      }));
      setDrafts(mapped);
      setRowExpandedById(
        mapped.reduce<Record<string, boolean>>((acc, row) => {
          acc[row.id] = row.parser_confidence < 70;
          return acc;
        }, {})
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.loadReview"));
    } finally {
      setLoading(false);
    }
  }, [syllabusId, resolveLatestSyllabusId, router, embedded]);

  useEffect(() => {
    void loadReview();
  }, [loadReview]);

  const approveHighConfidence = () => {
    setDrafts((current) =>
      current.map((draft) =>
        draft.parser_confidence >= 90 ? { ...draft, approved: true } : draft
      )
    );
  };

  const saveDraftEdits = async () => {
    setSavingDrafts(true);
    setError(null);
    try {
      for (const draft of drafts) {
        const response = await fetch(`/api/travis/syllabus/drafts/${draft.id}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            class_name: draft.class_name.trim(),
            assignment_name: draft.assignment_name.trim(),
            assignment_type: draft.assignment_type.trim() || null,
            due_date: draft.due_date || null,
            grading_weight:
              draft.grading_weight.trim() === "" ? null : Number(draft.grading_weight),
            draft_status: draft.approved ? "approved" : "rejected",
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || t("errors.saveDrafts"));
        }
      }
      await loadReview();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.saveDrafts"));
    } finally {
      setSavingDrafts(false);
    }
  };

  const publish = async () => {
    if (!syllabusId) return;
    setPublishing(true);
    setError(null);
    try {
      const payload = drafts.map((draft) => ({
        id: draft.id,
        class_name: draft.class_name.trim(),
        assignment_name: draft.assignment_name.trim(),
        assignment_type: draft.assignment_type.trim() || null,
        due_date: draft.due_date || null,
        grading_weight:
          draft.grading_weight.trim() === "" ? null : Number(draft.grading_weight),
        approved: draft.approved,
        rejected: !draft.approved,
      }));

      const response = await fetch(`/api/travis/syllabus/confirm/${syllabusId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          approve_all: false,
          drafts: payload,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || t("errors.publish"));
      }

      setShowPublishPreview(false);
      await loadReview();
      if (onPublished) {
        onPublished(syllabusId);
      } else {
        router.push(`/academic/assignments?syllabusId=${syllabusId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.publish"));
    } finally {
      setPublishing(false);
    }
  };

  const approvedDrafts = useMemo(() => drafts.filter((draft) => draft.approved), [drafts]);
  const rejectedCount = useMemo(
    () => drafts.filter((draft) => !draft.approved).length,
    [drafts]
  );
  const lowConfidenceApproved = useMemo(
    () => approvedDrafts.filter((draft) => draft.parser_confidence < 80),
    [approvedDrafts]
  );
  const workloadByWeek = useMemo(() => {
    const map = new Map<string, number>();
    approvedDrafts.forEach((draft) => {
      const key = weekStart(draft.due_date);
      if (!key) return;
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(0, 10);
  }, [approvedDrafts]);

  if (!syllabusId && embedded) return null;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <p className="text-sm font-semibold text-slate-100">{t("title")}</p>
        <p className="mt-2 text-sm text-slate-400">
          {t("description")}
        </p>
        {syllabus ? (
          <p className="mt-2 text-xs text-slate-400">
            {t("parserConfidence", {
              className: syllabus.class_name,
              confidence: confidencePct(syllabus.parse_confidence),
            })}
          </p>
        ) : null}
        {confidencePct(syllabus?.parse_confidence) < 60 ? (
          <p className="mt-2 text-xs text-amber-200">
            {t("lowConfidenceWarning")}
          </p>
        ) : null}
      </div>

      {loading ? (
        <AcademicLoadingState message={t("readingSyllabus")} className="!min-h-0 py-4" />
      ) : null}

      {!loading && drafts.length === 0 ? (
        <AcademicEmptyState
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          className="!min-h-0 py-4"
        />
      ) : null}

      {!loading && drafts.length > 0 ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={approveHighConfidence}
              className="rounded-lg border border-emerald-300/35 bg-emerald-500/15 px-3 py-1.5 text-xs text-emerald-100"
            >
              {t("approveHighConfidence")}
            </button>
            <button
              type="button"
              onClick={() => void saveDraftEdits()}
              disabled={savingDrafts}
              className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-slate-200"
            >
              {savingDrafts ? t("saving") : t("saveEdits")}
            </button>
            <button
              type="button"
              onClick={() => setShowPublishPreview(true)}
              className="rounded-lg border border-sky-300/35 bg-sky-500/15 px-3 py-1.5 text-xs text-sky-100"
            >
              {t("publishToAssignments")}
            </button>
          </div>

          <div className="space-y-3">
            {drafts.map((draft) => {
              const expanded = rowExpandedById[draft.id];
              const pct = draft.parser_confidence;
              return (
                <div key={draft.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setRowExpandedById((current) => ({
                          ...current,
                          [draft.id]: !current[draft.id],
                        }))
                      }
                      className="rounded border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-slate-300"
                    >
                      {expanded ? t("hide") : t("show")}
                    </button>
                    <span className={`rounded-full border px-2 py-1 text-[11px] ${confidenceClass(pct)}`}>
                      {t("confidence", { percent: pct })}
                    </span>
                    <p className={`text-sm ${draft.approved ? "text-slate-100" : "text-slate-500 line-through"}`}>
                      {draft.assignment_name || t("untitledAssignment")}
                    </p>
                  </div>
                  {expanded ? (
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      <input
                        value={draft.assignment_name}
                        onChange={(event) =>
                          setDrafts((current) =>
                            current.map((row) =>
                              row.id === draft.id
                                ? { ...row, assignment_name: event.target.value }
                                : row
                            )
                          )
                        }
                        className="rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm text-slate-100"
                        placeholder={t("placeholders.assignmentName")}
                      />
                      <select
                        value={draft.assignment_type}
                        onChange={(event) =>
                          setDrafts((current) =>
                            current.map((row) =>
                              row.id === draft.id
                                ? { ...row, assignment_type: event.target.value }
                                : row
                            )
                          )
                        }
                        className="rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm text-slate-100"
                      >
                        <option value="">{t("assignmentTypes.unspecified")}</option>
                        <option value="homework">{t("assignmentTypes.homework")}</option>
                        <option value="lab">{t("assignmentTypes.lab")}</option>
                        <option value="paper">{t("assignmentTypes.paper")}</option>
                        <option value="project">{t("assignmentTypes.project")}</option>
                        <option value="quiz">{t("assignmentTypes.quiz")}</option>
                        <option value="test">{t("assignmentTypes.test")}</option>
                      </select>
                      <input
                        type="date"
                        value={draft.due_date}
                        onChange={(event) =>
                          setDrafts((current) =>
                            current.map((row) =>
                              row.id === draft.id
                                ? { ...row, due_date: event.target.value }
                                : row
                            )
                          )
                        }
                        className="rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm text-slate-100"
                      />
                      <input
                        value={draft.grading_weight}
                        onChange={(event) =>
                          setDrafts((current) =>
                            current.map((row) =>
                              row.id === draft.id
                                ? { ...row, grading_weight: event.target.value }
                                : row
                            )
                          )
                        }
                        placeholder={t("placeholders.weight")}
                        className="rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm text-slate-100"
                      />
                      <div className="md:col-span-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setDrafts((current) =>
                              current.map((row) =>
                                row.id === draft.id ? { ...row, approved: true } : row
                              )
                            )
                          }
                          className="rounded-lg border border-emerald-300/35 bg-emerald-500/15 px-3 py-1.5 text-xs text-emerald-100"
                        >
                          {t("approve")}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDrafts((current) =>
                              current.map((row) =>
                                row.id === draft.id ? { ...row, approved: false } : row
                              )
                            )
                          }
                          className="rounded-lg border border-red-300/35 bg-red-500/15 px-3 py-1.5 text-xs text-red-100"
                        >
                          {t("reject")}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </>
      ) : null}

      {showPublishPreview ? (
        <SyllabusPublishPreviewModal
          publishing={publishing}
          approvedDrafts={approvedDrafts}
          rejectedCount={rejectedCount}
          workloadByWeek={workloadByWeek}
          lowConfidenceApprovedCount={lowConfidenceApproved.length}
          onClose={() => setShowPublishPreview(false)}
          onConfirm={publish}
        />
      ) : null}

      {error ? (
        <AcademicErrorState
          message={error}
          className="!min-h-0 border-red-500/40 bg-red-500/10 py-4"
          retry={() => {
            void loadReview();
          }}
        />
      ) : null}
    </div>
  );
}
