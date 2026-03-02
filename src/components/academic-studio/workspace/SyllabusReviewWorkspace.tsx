"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type DraftRow = {
  id: string;
  class_name: string;
  assignment_name: string;
  assignment_type: string | null;
  due_date: string | null;
  grading_weight: number | null;
  draft_status: "parsed" | "edited" | "approved" | "rejected" | "published";
  requirements?: {
    module?: number;
    item?: number;
  } | null;
};

type SyllabusPayload = {
  id: string;
  class_name: string;
  status: string | null;
  uploaded_at: string | null;
  confirmed: boolean;
};

type EditableDraft = {
  id: string;
  class_name: string;
  assignment_name: string;
  assignment_type: string;
  due_date: string;
  grading_weight: string;
  approved: boolean;
};

function toDateInputValue(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function parseModuleRef(row: DraftRow) {
  const moduleNumber =
    typeof row.requirements?.module === "number" ? row.requirements.module : null;
  const item = typeof row.requirements?.item === "number" ? row.requirements.item : null;
  return { moduleNumber, item };
}

type SyllabusReviewWorkspaceProps = {
  syllabusIdOverride?: string | null;
  embedded?: boolean;
  onPublished?: (syllabusId: string) => void;
};

export default function SyllabusReviewWorkspace({
  syllabusIdOverride = null,
  embedded = false,
  onPublished,
}: SyllabusReviewWorkspaceProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const syllabusId = syllabusIdOverride ?? searchParams.get("syllabusId");
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [savingDrafts, setSavingDrafts] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syllabus, setSyllabus] = useState<SyllabusPayload | null>(null);
  const [drafts, setDrafts] = useState<EditableDraft[]>([]);
  const [originalDraftsById, setOriginalDraftsById] = useState<
    Record<string, EditableDraft>
  >({});

  const approvedCount = useMemo(
    () => drafts.filter((draft) => draft.approved).length,
    [drafts]
  );

  const resolveLatestSyllabusId = useCallback(async () => {
    const latestResponse = await fetch("/api/travis/syllabus/latest");
    const latestData = await latestResponse.json();
    if (!latestResponse.ok) {
      throw new Error(latestData.error || "Failed to load latest syllabus.");
    }
    return latestData?.syllabus?.id as string | undefined;
  }, []);

  const loadReview = useCallback(async () => {
    let targetSyllabusId = syllabusId;
    if (!targetSyllabusId) {
      targetSyllabusId = await resolveLatestSyllabusId();
      if (!targetSyllabusId) return;
      if (!embedded) {
        router.replace(
          `/academic-studio/dashboard?workspace=syllabi&syllabusId=${targetSyllabusId}`
        );
      }
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/travis/syllabus/${targetSyllabusId}`);
      const data = await response.json();
      if (response.status === 404) {
        const latestId = await resolveLatestSyllabusId();
        if (latestId && latestId !== targetSyllabusId) {
          if (!embedded) {
            router.replace(
              `/academic-studio/dashboard?workspace=syllabi&syllabusId=${latestId}`
            );
          }
          return;
        }
      }
      if (!response.ok) {
        throw new Error(data.error || "Failed to load syllabus review.");
      }

      setSyllabus(data.syllabus as SyllabusPayload);
      const rows = ((data.drafts || []) as DraftRow[]).sort((a, b) => {
        const aRef = parseModuleRef(a);
        const bRef = parseModuleRef(b);
        if (aRef.moduleNumber !== null && bRef.moduleNumber !== null) {
          if (aRef.moduleNumber !== bRef.moduleNumber) {
            return aRef.moduleNumber - bRef.moduleNumber;
          }
          if (aRef.item !== null && bRef.item !== null && aRef.item !== bRef.item) {
            return aRef.item - bRef.item;
          }
        } else if (aRef.moduleNumber !== null) {
          return -1;
        } else if (bRef.moduleNumber !== null) {
          return 1;
        }
        return (a.assignment_name || "").localeCompare(b.assignment_name || "");
      });
      setDrafts(
        rows.map((row) => ({
          id: row.id,
          class_name: row.class_name || data.syllabus?.class_name || "",
          assignment_name: row.assignment_name || "",
          assignment_type: row.assignment_type || "",
          due_date: toDateInputValue(row.due_date),
          grading_weight:
            typeof row.grading_weight === "number"
              ? String(row.grading_weight)
              : "",
          approved: row.draft_status !== "rejected",
        }))
      );
      const originalMap: Record<string, EditableDraft> = {};
      rows.forEach((row) => {
        originalMap[row.id] = {
          id: row.id,
          class_name: row.class_name || data.syllabus?.class_name || "",
          assignment_name: row.assignment_name || "",
          assignment_type: row.assignment_type || "",
          due_date: toDateInputValue(row.due_date),
          grading_weight:
            typeof row.grading_weight === "number"
              ? String(row.grading_weight)
              : "",
          approved: row.draft_status !== "rejected",
        };
      });
      setOriginalDraftsById(originalMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load review.");
    } finally {
      setLoading(false);
    }
  }, [syllabusId, resolveLatestSyllabusId, router, embedded]);

  useEffect(() => {
    loadReview();
  }, [loadReview]);

  const publish = async () => {
    if (!syllabusId) return;
    setPublishing(true);
    setError(null);
    try {
      const payload = drafts.map((draft) => {
        const parsedWeight = Number(draft.grading_weight);
        return {
          id: draft.id,
          class_name: draft.class_name.trim(),
          assignment_name: draft.assignment_name.trim(),
          assignment_type: draft.assignment_type.trim() || null,
          due_date: draft.due_date || null,
          grading_weight:
            draft.grading_weight.trim() === ""
              ? null
              : Number.isFinite(parsedWeight)
                ? parsedWeight
                : null,
          approved: draft.approved,
          rejected: !draft.approved,
        };
      });

      const response = await fetch(`/api/travis/syllabus/confirm/${syllabusId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approve_all: false,
          drafts: payload,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Approve and publish failed.");
      }

      await loadReview();
      if (onPublished && syllabusId) {
        onPublished(syllabusId);
      } else if (syllabusId) {
        router.push(
          `/academic-studio/dashboard?workspace=assignments&syllabusId=${syllabusId}`
        );
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Approve and publish failed."
      );
    } finally {
      setPublishing(false);
    }
  };

  const saveDraftEdits = async () => {
    setSavingDrafts(true);
    setError(null);
    try {
      const changedRows = drafts.filter((draft) => {
        const original = originalDraftsById[draft.id];
        if (!original) return true;
        return (
          draft.class_name !== original.class_name ||
          draft.assignment_name !== original.assignment_name ||
          draft.assignment_type !== original.assignment_type ||
          draft.due_date !== original.due_date ||
          draft.grading_weight !== original.grading_weight ||
          draft.approved !== original.approved
        );
      });

      if (changedRows.length === 0) {
        return;
      }

      for (const draft of changedRows) {
        const response = await fetch(`/api/travis/syllabus/drafts/${draft.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            class_name: draft.class_name.trim(),
            assignment_name: draft.assignment_name.trim(),
            assignment_type: draft.assignment_type.trim() || null,
            due_date: draft.due_date || null,
            grading_weight:
              draft.grading_weight.trim() === ""
                ? null
                : Number(draft.grading_weight),
            draft_status: draft.approved ? "approved" : "rejected",
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Failed to save draft edits.");
        }
      }

      await loadReview();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save draft edits."
      );
    } finally {
      setSavingDrafts(false);
    }
  };

  if (!syllabusId) {
    if (embedded) return null;
    return (
      <div className="academic-nested-card rounded-2xl p-6">
        <p className="text-sm font-semibold text-slate-100">Syllabus review</p>
        <p className="mt-2 text-sm text-slate-400">
          Upload a syllabus from Travis, then open review from the action button.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="academic-nested-card rounded-2xl p-6">
        <p className="text-sm font-semibold text-slate-100">Syllabus review</p>
        <p className="mt-2 text-sm text-slate-400">
          Edit parsed assignments, approve what should publish, and reject what
          should be excluded.
        </p>
        {syllabus && (
          <p className="mt-3 text-xs text-slate-400">
            {syllabus.class_name} · status: {syllabus.status || "draft"}
          </p>
        )}
      </div>

      {loading && (
        <div className="academic-nested-card rounded-2xl p-6 text-sm text-slate-400">
          Loading syllabus review...
        </div>
      )}

      {!loading && drafts.length === 0 && (
        <div className="academic-nested-card rounded-2xl p-6 text-sm text-slate-400">
          No parsed assignments found.
        </div>
      )}

      {!loading && drafts.length > 0 && (
        <div className="space-y-3">
          {drafts.map((draft) => (
            <div key={draft.id} className="academic-nested-card rounded-2xl p-4">
              <div className="grid gap-2 md:grid-cols-2">
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
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 focus:border-sky-400/50 focus:outline-none"
                  placeholder="Assignment name"
                />
                <input
                  value={draft.class_name}
                  onChange={(event) =>
                    setDrafts((current) =>
                      current.map((row) =>
                        row.id === draft.id
                          ? { ...row, class_name: event.target.value }
                          : row
                      )
                    )
                  }
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 focus:border-sky-400/50 focus:outline-none"
                  placeholder="Class"
                />
                <input
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
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 focus:border-sky-400/50 focus:outline-none"
                  placeholder="Type"
                />
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
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 focus:border-sky-400/50 focus:outline-none"
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
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 focus:border-sky-400/50 focus:outline-none"
                  placeholder="Grading weight (e.g. 0.2)"
                />
                <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={draft.approved}
                    onChange={(event) =>
                      setDrafts((current) =>
                        current.map((row) =>
                          row.id === draft.id
                            ? { ...row, approved: event.target.checked }
                            : row
                        )
                      )
                    }
                  />
                  Approve this assignment
                </label>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={saveDraftEdits}
            disabled={savingDrafts || publishing}
            className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm font-medium text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {savingDrafts ? "Saving..." : "Save draft edits"}
          </button>

          <button
            type="button"
            onClick={publish}
            disabled={publishing || savingDrafts || approvedCount === 0}
            className="w-full rounded-xl border border-sky-400/40 bg-sky-500/20 px-4 py-3 text-sm font-medium text-sky-100 transition hover:bg-sky-500/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {publishing
              ? "Publishing..."
              : `Approve & publish ${approvedCount} assignments`}
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
