"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import SyllabusReviewWorkspace from "./SyllabusReviewWorkspace";

type SyllabusListItem = {
  id: string;
  class_name: string;
  status: string;
  uploaded_at: string | null;
  reviewed_at: string | null;
  confirmed: boolean;
  counts: {
    drafts: {
      total: number;
      approved: number;
      rejected: number;
      published: number;
    };
    assignments: {
      total: number;
      active: number;
      completed: number;
      archived: number;
    };
  };
};

type DiffItem = {
  key: string;
  assignment_name: string;
  assignment_type: string | null;
  due_date: string | null;
  grading_weight: number | null;
  module_reference: string | null;
};

type SyllabusDiff = {
  from_id: string;
  to_id: string;
  class_name: string | null;
  counts: {
    added: number;
    removed: number;
    changed: number;
  };
  added: DiffItem[];
  removed: DiffItem[];
  changed: Array<{ from: DiffItem; to: DiffItem }>;
};

export default function SyllabiWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const syllabusIdFromUrl = searchParams.get("syllabusId");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<SyllabusListItem[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [diffLoadingId, setDiffLoadingId] = useState<string | null>(null);
  const [diffBySyllabusId, setDiffBySyllabusId] = useState<
    Record<string, SyllabusDiff | undefined>
  >({});
  const [activeReviewSyllabusId, setActiveReviewSyllabusId] = useState<string | null>(null);

  const classGroups = useMemo(() => {
    const map = new Map<string, SyllabusListItem[]>();
    items.forEach((item) => {
      const key = item.class_name || "Uncategorized";
      const existing = map.get(key) || [];
      existing.push(item);
      map.set(key, existing);
    });
    Array.from(map.entries()).forEach(([key, group]) => {
      group.sort((a, b) => {
        const aTime = new Date(a.uploaded_at || 0).getTime();
        const bTime = new Date(b.uploaded_at || 0).getTime();
        return bTime - aTime;
      });
      map.set(key, group);
    });
    return map;
  }, [items]);

  const previousVersionById = useMemo(() => {
    const mapping = new Map<string, SyllabusListItem | null>();
    classGroups.forEach((group) => {
      group.forEach((item, idx) => {
        mapping.set(item.id, group[idx + 1] || null);
      });
    });
    return mapping;
  }, [classGroups]);

  const loadSyllabi = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/travis/syllabi");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to load syllabi.");
      }
      setItems(data.syllabi || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load syllabi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSyllabi();
  }, []);

  useEffect(() => {
    if (syllabusIdFromUrl) {
      setActiveReviewSyllabusId(syllabusIdFromUrl);
    }
  }, [syllabusIdFromUrl]);

  const publishSyllabus = async (syllabusId: string) => {
    setBusyId(syllabusId);
    setError(null);
    try {
      const response = await fetch(`/api/travis/syllabus/confirm/${syllabusId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approve_all: true }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Publish failed.");
      }
      await loadSyllabi();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed.");
    } finally {
      setBusyId(null);
    }
  };

  const archiveSyllabus = async (syllabusId: string) => {
    setBusyId(syllabusId);
    setError(null);
    try {
      const response = await fetch(`/api/travis/syllabus/archive/${syllabusId}`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Archive failed.");
      }
      await loadSyllabi();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Archive failed.");
    } finally {
      setBusyId(null);
    }
  };

  const loadDiffAgainstPrevious = async (item: SyllabusListItem) => {
    const previous = previousVersionById.get(item.id);
    if (!previous) return;
    setDiffLoadingId(item.id);
    setError(null);
    try {
      const params = new URLSearchParams({
        from_id: previous.id,
        to_id: item.id,
      });
      const response = await fetch(`/api/travis/syllabi/diff?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to load syllabus diff.");
      }
      setDiffBySyllabusId((current) => ({
        ...current,
        [item.id]: data.diff as SyllabusDiff,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load diff.");
    } finally {
      setDiffLoadingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="academic-nested-card rounded-2xl p-6">
        <p className="text-sm font-semibold text-slate-100">Syllabi</p>
        <p className="mt-2 text-sm text-slate-400">
          Every uploaded syllabus version is listed here. Review drafts, publish,
          and archive without losing history.
        </p>
      </div>

      {loading && (
        <div className="academic-nested-card rounded-2xl p-6 text-sm text-slate-400">
          Loading syllabi...
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="academic-nested-card rounded-2xl p-6 text-sm text-slate-400">
          No syllabi uploaded yet.
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="space-y-3">
          {Array.from(classGroups.entries()).map(([className, group]) => (
            <div key={className} className="academic-nested-card rounded-2xl p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                {className} timeline
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {group.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveReviewSyllabusId(item.id)}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10"
                  >
                    v{group.length - index} · {item.status}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="grid gap-3">
          {items.map((item) => {
            const isBusy = busyId === item.id;
            const previous = previousVersionById.get(item.id);
            const diff = diffBySyllabusId[item.id];
            return (
              <div key={item.id} className="academic-nested-card rounded-2xl p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-100">
                      {item.class_name}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Uploaded{" "}
                      {item.uploaded_at
                        ? new Date(item.uploaded_at).toLocaleString()
                        : "Unknown"}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Status: {item.status}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveReviewSyllabusId(item.id)}
                      className="rounded-lg border border-sky-400/40 bg-sky-500/20 px-3 py-1.5 text-xs text-sky-100"
                    >
                      Review
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => publishSyllabus(item.id)}
                      className="rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-1.5 text-xs text-emerald-100 disabled:opacity-60"
                    >
                      Publish
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => archiveSyllabus(item.id)}
                      className="rounded-lg border border-amber-400/40 bg-amber-500/15 px-3 py-1.5 text-xs text-amber-100 disabled:opacity-60"
                    >
                      Archive
                    </button>
                    {previous && (
                      <button
                        type="button"
                        disabled={diffLoadingId === item.id}
                        onClick={() => loadDiffAgainstPrevious(item)}
                        className="rounded-lg border border-violet-400/40 bg-violet-500/15 px-3 py-1.5 text-xs text-violet-100 disabled:opacity-60"
                      >
                        {diffLoadingId === item.id
                          ? "Loading diff..."
                          : "Diff vs previous"}
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
                    Drafts: {item.counts.drafts.total}
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
                    Published drafts: {item.counts.drafts.published}
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
                    Active assignments: {item.counts.assignments.active}
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
                    Archived assignments: {item.counts.assignments.archived}
                  </div>
                </div>

                {diff && (
                  <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-slate-300">
                    <p className="font-semibold text-slate-200">
                      Diff vs previous version
                    </p>
                    <div className="mt-2 flex flex-wrap gap-3">
                      <span>Added: {diff.counts.added}</span>
                      <span>Changed: {diff.counts.changed}</span>
                      <span>Removed: {diff.counts.removed}</span>
                    </div>
                    {diff.added.length > 0 && (
                      <div className="mt-2">
                        <p className="text-emerald-300">Added</p>
                        <ul className="mt-1 space-y-1">
                          {diff.added.slice(0, 8).map((row) => (
                            <li key={`added-${row.key}`}>+ {row.assignment_name}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {diff.changed.length > 0 && (
                      <div className="mt-2">
                        <p className="text-amber-300">Changed</p>
                        <ul className="mt-1 space-y-1">
                          {diff.changed.slice(0, 8).map((row) => (
                            <li key={`changed-${row.to.key}`}>
                              ~ {row.from.assignment_name}
                              {" -> "}
                              {row.to.assignment_name}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {diff.removed.length > 0 && (
                      <div className="mt-2">
                        <p className="text-rose-300">Removed</p>
                        <ul className="mt-1 space-y-1">
                          {diff.removed.slice(0, 8).map((row) => (
                            <li key={`removed-${row.key}`}>- {row.assignment_name}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          </div>

          {activeReviewSyllabusId && (
            <div className="academic-nested-card rounded-2xl p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Review And Publish
                </p>
                <button
                  type="button"
                  onClick={() => setActiveReviewSyllabusId(null)}
                  className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-slate-300"
                >
                  Close
                </button>
              </div>
              <SyllabusReviewWorkspace
                syllabusIdOverride={activeReviewSyllabusId}
                embedded
                onPublished={(syllabusId) => {
                  setActiveReviewSyllabusId(null);
                  loadSyllabi();
                  router.push(
                    `/academic-studio/dashboard?workspace=assignments&syllabusId=${syllabusId}`
                  );
                }}
              />
            </div>
          )}
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
