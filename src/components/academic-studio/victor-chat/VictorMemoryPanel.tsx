"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AcademicEmptyState from "../shared/AcademicEmptyState";
import AcademicErrorState from "../shared/AcademicErrorState";
import AcademicLoadingState from "../shared/AcademicLoadingState";

type MemoryItem = {
  id: string;
  class_name: string;
  concept: string;
  struggle_type: string;
  detected_at: string;
  resolved: boolean;
  resolved_at: string | null;
};

export default function VictorMemoryPanel({
  open,
  onClose,
  classNameFilter,
}: {
  open: boolean;
  onClose: () => void;
  classNameFilter?: string;
}) {
  const [items, setItems] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  const loadMemory = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({ includeResolved: "true" });
      if (classNameFilter?.trim()) {
        query.set("className", classNameFilter.trim());
      }
      const response = await fetch(`/api/victor/memory?${query.toString()}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to load Victor memory.");
      }
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load Victor memory.");
    } finally {
      setLoading(false);
    }
  }, [classNameFilter, open]);

  useEffect(() => {
    void loadMemory();
  }, [loadMemory]);

  const grouped = useMemo(() => {
    const map = new Map<string, MemoryItem[]>();
    for (const item of items) {
      const key = item.class_name || "Uncategorized";
      const existing = map.get(key) ?? [];
      existing.push(item);
      map.set(key, existing);
    }

    for (const entries of map.values()) {
      entries.sort((a, b) => {
        if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;
        return new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime();
      });
    }

    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [items]);

  const handleResolve = useCallback(async (id: string) => {
    setUpdatingId(id);
    setError(null);
    try {
      const response = await fetch(`/api/victor/memory/${id}/resolve`, {
        method: "PATCH",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to resolve memory item.");
      }
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, resolved: true, resolved_at: new Date().toISOString() }
            : item
        )
      );
    } catch (resolveError) {
      setError(resolveError instanceof Error ? resolveError.message : "Failed to resolve memory item.");
    } finally {
      setUpdatingId(null);
    }
  }, []);

  const handleClearAll = useCallback(async () => {
    const confirmed = window.confirm(
      "This will permanently clear everything Victor has noted. This cannot be undone."
    );
    if (!confirmed) return;

    setClearing(true);
    setError(null);
    try {
      const response = await fetch("/api/victor/memory", { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to clear Victor memory.");
      }
      setItems([]);
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : "Failed to clear Victor memory.");
    } finally {
      setClearing(false);
    }
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-[#0B1220] p-4 text-slate-100 shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.12em]">
            What Victor remembers
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleClearAll()}
              disabled={clearing}
              className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300 transition hover:bg-white/10 disabled:opacity-60"
            >
              {clearing ? "Clearing..." : "Clear all"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300 transition hover:bg-white/10"
            >
              Close
            </button>
          </div>
        </div>

        <div className="mt-4 max-h-[70vh] overflow-y-auto pr-1">
          {loading ? (
            <AcademicLoadingState message="Loading Victor memory..." className="!min-h-0 py-6" />
          ) : error ? (
            <AcademicErrorState message={error} className="!min-h-0 py-6" />
          ) : grouped.length === 0 ? (
            <AcademicEmptyState
              title="No memory entries yet"
              description="Victor has not logged any recurring concept struggles yet."
              className="!min-h-0 py-8"
            />
          ) : (
            <div className="space-y-4">
              {grouped.map(([className, entries]) => (
                <section key={className} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <h4 className="text-sm font-semibold text-slate-100">{className}</h4>
                  <div className="mt-3 space-y-2">
                    {entries.map((entry) => (
                      <div
                        key={entry.id}
                        className={`rounded-lg border px-3 py-2 text-xs ${
                          entry.resolved
                            ? "border-white/5 bg-white/[0.02] text-slate-500"
                            : "border-white/10 bg-white/[0.04] text-slate-200"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p>
                            Struggled with: <span className="font-medium">{entry.concept}</span>
                          </p>
                          {entry.resolved ? (
                            <span className="text-[11px] text-emerald-300">Resolved</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void handleResolve(entry.id)}
                              disabled={updatingId === entry.id}
                              className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-slate-200 transition hover:bg-white/10 disabled:opacity-60"
                            >
                              {updatingId === entry.id ? "Saving..." : "Mark resolved"}
                            </button>
                          )}
                        </div>
                        <p className="mt-1 text-[11px] text-slate-400">
                          Detected {new Date(entry.detected_at).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
