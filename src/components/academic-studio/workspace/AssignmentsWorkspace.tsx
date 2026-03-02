// src/components/academic-studio/workspace/AssignmentsWorkspace.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Archive,
  ArrowDownUp,
  CalendarClock,
  CheckCircle2,
  Orbit,
  ListFilter,
} from "lucide-react";
import TravisSidebar from "../travis-sidebar/TravisSidebar";
import type { AssignmentRow } from "@/types/academic-studio";

type AssignmentStatusFilter = "active" | "completed" | "archived" | "all";
type SortKey = "assignment_name" | "class_name" | "assignment_type" | "due_date" | "status";
type SortDirection = "asc" | "desc";
type TableDensity = "comfortable" | "compact";

type AssignmentListRow = AssignmentRow & {
  syllabus_id: string | null;
  archived_at: string | null;
  updated_at?: string | null;
};

export default function AssignmentsWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const syllabusIdFromUrl = searchParams.get("syllabusId");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<AssignmentListRow[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(
    null
  );
  const [savingDetails, setSavingDetails] = useState(false);
  const [updatingChecklistId, setUpdatingChecklistId] = useState<string | null>(
    null
  );
  const [detailsDraft, setDetailsDraft] = useState({
    instructions: "",
    guidelines: "",
    notes: "",
  });
  const [statusFilter, setStatusFilter] = useState<AssignmentStatusFilter>("active");
  const [classFilter, setClassFilter] = useState<string>("");
  const [syllabusFilter, setSyllabusFilter] = useState<string>(syllabusIdFromUrl || "");
  const [sortKey, setSortKey] = useState<SortKey>("due_date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [tableDensity, setTableDensity] = useState<TableDensity>("comfortable");

  const classes = useMemo(
    () =>
      Array.from(new Set(rows.map((row) => row.class_name).filter(Boolean))).sort(
        (a, b) => a.localeCompare(b)
      ),
    [rows]
  );
  const metrics = useMemo(() => {
    const now = Date.now();
    const active = rows.filter((row) => !row.archived_at && !row.completed).length;
    const completed = rows.filter((row) => !row.archived_at && row.completed).length;
    const archived = rows.filter((row) => Boolean(row.archived_at)).length;
    const upcomingSoon = rows.filter((row) => {
      if (row.archived_at || row.completed || !row.due_date) return false;
      const due = new Date(row.due_date).getTime();
      if (Number.isNaN(due)) return false;
      const diffDays = (due - now) / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays <= 7;
    }).length;
    return { active, completed, archived, upcomingSoon };
  }, [rows]);

  const sortedRows = useMemo(() => {
    const getStatusRank = (row: AssignmentListRow) => {
      if (row.archived_at) return 2;
      if (row.completed) return 1;
      return 0;
    };
    const compareString = (a: string | null | undefined, b: string | null | undefined) =>
      (a || "").localeCompare(b || "", undefined, { sensitivity: "base" });
    const compareDue = (a: string | null, b: string | null) => {
      if (!a && !b) return 0;
      if (!a) return 1;
      if (!b) return -1;
      const aTime = new Date(a).getTime();
      const bTime = new Date(b).getTime();
      if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
      if (Number.isNaN(aTime)) return 1;
      if (Number.isNaN(bTime)) return -1;
      return aTime - bTime;
    };

    const next = [...rows].sort((a, b) => {
      let result = 0;
      if (sortKey === "assignment_name") {
        result = compareString(a.assignment_name, b.assignment_name);
      } else if (sortKey === "class_name") {
        result = compareString(a.class_name, b.class_name);
      } else if (sortKey === "assignment_type") {
        result = compareString(a.assignment_type, b.assignment_type);
      } else if (sortKey === "due_date") {
        result = compareDue(a.due_date, b.due_date);
      } else if (sortKey === "status") {
        result = getStatusRank(a) - getStatusRank(b);
      }

      if (result === 0) {
        return compareString(a.assignment_name, b.assignment_name);
      }
      return sortDirection === "asc" ? result : -result;
    });

    return next;
  }, [rows, sortDirection, sortKey]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  };

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return "↕";
    return sortDirection === "asc" ? "↑" : "↓";
  };
  const sortLabel = sortKey.replace(/_/g, " ");
  const isCompact = tableDensity === "compact";

  const loadAllAssignments = useCallback(async (status: AssignmentStatusFilter) => {
    setLoading(true);
    setError(null);
    try {
      const search = new URLSearchParams({ status });
      if (classFilter) search.set("class_name", classFilter);
      if (syllabusFilter) search.set("syllabus_id", syllabusFilter);
      const response = await fetch(`/api/travis/assignments/all?${search.toString()}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to load assignments.");
      }
      setRows(data.assignments || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load assignments.");
    } finally {
      setLoading(false);
    }
  }, [classFilter, syllabusFilter]);

  useEffect(() => {
    loadAllAssignments(statusFilter);
  }, [statusFilter, loadAllAssignments]);

  useEffect(() => {
    setSyllabusFilter(syllabusIdFromUrl || "");
  }, [syllabusIdFromUrl]);

  useEffect(() => {
    if (!selectedAssignmentId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedAssignmentId(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedAssignmentId]);

  const selectedAssignment = useMemo(
    () => rows.find((row) => row.id === selectedAssignmentId) || null,
    [rows, selectedAssignmentId]
  );

  const openAssignmentDetails = (row: AssignmentListRow) => {
    setSelectedAssignmentId(row.id);
    setDetailsDraft({
      instructions: row.requirements?.instructions || "",
      guidelines: row.requirements?.guidelines || "",
      notes: row.notes || "",
    });
  };

  const saveAssignmentDetails = async () => {
    if (!selectedAssignment) return;
    setSavingDetails(true);
    setError(null);
    try {
      const nextRequirements: Record<string, unknown> = {
        ...(selectedAssignment.requirements || {}),
      };
      if (detailsDraft.instructions.trim()) {
        nextRequirements.instructions = detailsDraft.instructions.trim();
      } else {
        delete nextRequirements.instructions;
      }
      if (detailsDraft.guidelines.trim()) {
        nextRequirements.guidelines = detailsDraft.guidelines.trim();
      } else {
        delete nextRequirements.guidelines;
      }

      const response = await fetch(
        `/api/travis/assignment/update/${selectedAssignment.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            notes: detailsDraft.notes.trim() || null,
            requirements:
              Object.keys(nextRequirements).length > 0 ? nextRequirements : null,
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to save assignment details.");
      }
      await loadAllAssignments(statusFilter);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save assignment details."
      );
    } finally {
      setSavingDetails(false);
    }
  };

  const passAssignmentToVictor = () => {
    if (!selectedAssignment) return;
    const dueLabel = selectedAssignment.due_date
      ? new Date(selectedAssignment.due_date).toLocaleDateString()
      : "No due date";
    const prompt = [
      `Help me plan how to tackle this assignment step-by-step.`,
      `Assignment: ${selectedAssignment.assignment_name}`,
      `Class: ${selectedAssignment.class_name}`,
      `Type: ${selectedAssignment.assignment_type || "unspecified"}`,
      `Due: ${dueLabel}`,
      detailsDraft.instructions.trim()
        ? `Instructions: ${detailsDraft.instructions.trim()}`
        : null,
      detailsDraft.guidelines.trim()
        ? `Guidelines: ${detailsDraft.guidelines.trim()}`
        : null,
      detailsDraft.notes.trim() ? `Notes: ${detailsDraft.notes.trim()}` : null,
      `Give me: 1) approach strategy, 2) checklist, 3) risks to avoid, 4) first action to take now.`,
    ]
      .filter(Boolean)
      .join("\n");

    const url = new URL(window.location.href);
    url.searchParams.set("workspace", "assignments");
    url.searchParams.set("assignmentId", selectedAssignment.id);
    url.searchParams.set("victorMode", "challenge");
    url.searchParams.set("victorPrompt", prompt);
    router.push(url.toString());
    setSelectedAssignmentId(null);
  };

  const toggleAssignmentCompleted = async (
    row: AssignmentListRow,
    completed: boolean
  ) => {
    if (row.archived_at) return;
    setUpdatingChecklistId(row.id);
    setError(null);
    try {
      const response = await fetch(`/api/travis/assignment/update/${row.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to update checklist status.");
      }

      await loadAllAssignments(statusFilter);
      if (selectedAssignmentId === row.id && completed) {
        setSelectedAssignmentId(null);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update checklist status."
      );
    } finally {
      setUpdatingChecklistId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950 via-[#07172e] to-slate-900 p-6 shadow-[0_20px_70px_rgba(2,6,23,0.55)]">
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-8 h-56 w-56 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-cyan-200/90">
              Workspace
            </p>
            <p className="mt-1 text-2xl font-semibold text-white md:text-3xl">
              Assignment Control Center
            </p>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              Manage deadlines, status, and assignment guidance in one place.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-500/10 px-4 py-2 text-xs font-medium text-cyan-100">
            <Orbit className="h-3.5 w-3.5" />
            {rows.length} assignments in current view
          </div>
        </div>
        {syllabusFilter && (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
            <span>Showing assignments from published syllabus context.</span>
            <button
              type="button"
              onClick={() => {
                setSyllabusFilter("");
                const url = new URL(window.location.href);
                url.searchParams.delete("syllabusId");
                router.replace(url.toString());
              }}
              className="rounded-lg border border-cyan-200/40 bg-cyan-500/20 px-2 py-1 text-[11px] text-cyan-50"
            >
              Show all syllabi
            </button>
          </div>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-cyan-300/25 bg-gradient-to-b from-cyan-500/15 to-cyan-500/5 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.16em] text-cyan-100">Active</p>
            <ListFilter className="h-4 w-4 text-cyan-200" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-white">{metrics.active}</p>
        </div>
        <div className="rounded-2xl border border-emerald-300/25 bg-gradient-to-b from-emerald-500/15 to-emerald-500/5 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.16em] text-emerald-100">Completed</p>
            <CheckCircle2 className="h-4 w-4 text-emerald-200" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-white">{metrics.completed}</p>
        </div>
        <div className="rounded-2xl border border-amber-300/25 bg-gradient-to-b from-amber-500/15 to-amber-500/5 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.16em] text-amber-100">Due in 7 days</p>
            <CalendarClock className="h-4 w-4 text-amber-100" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-white">{metrics.upcomingSoon}</p>
        </div>
        <div className="rounded-2xl border border-slate-300/20 bg-gradient-to-b from-slate-500/15 to-slate-500/5 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-200">Archived</p>
            <Archive className="h-4 w-4 text-slate-200" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-white">{metrics.archived}</p>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-[#0b1628]/95 to-slate-950/95 p-6 shadow-[0_20px_60px_rgba(2,6,23,0.45)] backdrop-blur">
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as AssignmentStatusFilter)
            }
            className="rounded-xl border border-white/15 bg-slate-950/80 px-3 py-2 text-xs font-medium text-slate-100 outline-none transition focus:border-cyan-300/50"
          >
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
            <option value="all">All</option>
          </select>
          <select
            value={classFilter}
            onChange={(event) => setClassFilter(event.target.value)}
            className="rounded-xl border border-white/15 bg-slate-950/80 px-3 py-2 text-xs font-medium text-slate-100 outline-none transition focus:border-cyan-300/50"
          >
            <option value="">All classes</option>
            {classes.map((className) => (
              <option key={className} value={className}>
                {className}
              </option>
            ))}
          </select>
          <span className="ml-auto text-[11px] text-slate-400">
            Click any assignment row to open details.
          </span>
          <span className="text-[11px] text-slate-500">
            Check items off as you complete them.
          </span>
          <div className="ml-auto inline-flex items-center gap-1 rounded-xl border border-white/10 bg-slate-950/80 p-1">
            <button
              type="button"
              onClick={() => setTableDensity("comfortable")}
              className={`rounded-lg px-2 py-1 text-[11px] transition ${
                tableDensity === "comfortable"
                  ? "bg-cyan-500/20 text-cyan-100"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Comfortable
            </button>
            <button
              type="button"
              onClick={() => setTableDensity("compact")}
              className={`rounded-lg px-2 py-1 text-[11px] transition ${
                tableDensity === "compact"
                  ? "bg-cyan-500/20 text-cyan-100"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Compact
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] table-fixed text-left text-xs text-slate-300">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-white/10 bg-slate-900/95 text-slate-300 backdrop-blur">
                  <th className="sticky left-0 z-20 w-[70px] py-3 pl-4 pr-3 text-[11px] font-semibold uppercase tracking-[0.12em] bg-slate-900/95">
                    Done
                  </th>
                  <th className="sticky left-[70px] z-20 w-[320px] py-3 pl-4 pr-3 uppercase tracking-[0.12em] bg-slate-900/95">
                    <button
                      type="button"
                      onClick={() => toggleSort("assignment_name")}
                      className="inline-flex items-center gap-2 text-[11px] font-semibold transition hover:text-white"
                    >
                      Assignment <span>{sortIndicator("assignment_name")}</span>
                    </button>
                  </th>
                  <th className="w-[220px] py-3 pr-3 uppercase tracking-[0.12em]">
                    <button
                      type="button"
                      onClick={() => toggleSort("class_name")}
                      className="inline-flex items-center gap-2 text-[11px] font-semibold transition hover:text-white"
                    >
                      Class <span>{sortIndicator("class_name")}</span>
                    </button>
                  </th>
                  <th className="w-[160px] py-3 pr-3 uppercase tracking-[0.12em]">
                    <button
                      type="button"
                      onClick={() => toggleSort("assignment_type")}
                      className="inline-flex items-center gap-2 text-[11px] font-semibold transition hover:text-white"
                    >
                      Type <span>{sortIndicator("assignment_type")}</span>
                    </button>
                  </th>
                  <th className="w-[140px] py-3 pr-3 uppercase tracking-[0.12em]">
                    <button
                      type="button"
                      onClick={() => toggleSort("due_date")}
                      className="inline-flex items-center gap-2 text-[11px] font-semibold transition hover:text-white"
                    >
                      Due <span>{sortIndicator("due_date")}</span>
                    </button>
                  </th>
                  <th className="w-[130px] py-3 pr-4 uppercase tracking-[0.12em]">
                    <button
                      type="button"
                      onClick={() => toggleSort("status")}
                      className="inline-flex items-center gap-2 text-[11px] font-semibold transition hover:text-white"
                    >
                      Status <span>{sortIndicator("status")}</span>
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
              {loading && (
                <tr>
                  <td className="py-5 pl-4 text-slate-400" colSpan={6}>
                    Loading assignments...
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td className="py-5 pl-4 text-slate-400" colSpan={6}>
                    No assignments found for this filter.
                  </td>
                </tr>
              )}
              {!loading &&
                sortedRows.map((row) => (
                  <tr
                    key={row.id}
                    className={`cursor-pointer border-b border-white/5 transition ${
                      selectedAssignmentId === row.id
                        ? "bg-cyan-500/15"
                        : "bg-slate-900/45 hover:bg-slate-800/75"
                    }`}
                    onClick={() => openAssignmentDetails(row)}
                  >
                    <td
                      className={`sticky left-0 z-[1] pl-4 pr-3 ${
                        isCompact ? "py-1.5" : "py-2.5"
                      } ${
                        selectedAssignmentId === row.id
                          ? "bg-cyan-500/15"
                          : "bg-slate-900/45"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={row.completed}
                        disabled={Boolean(row.archived_at) || updatingChecklistId === row.id}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) =>
                          toggleAssignmentCompleted(row, event.target.checked)
                        }
                        className="h-4 w-4 cursor-pointer rounded border-white/30 bg-slate-900 text-sky-400 focus:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label={`Mark ${row.assignment_name} complete`}
                      />
                    </td>
                    <td
                      className={`sticky left-[70px] z-[1] pl-4 pr-3 text-sm font-medium text-slate-100 ${
                        isCompact ? "py-1.5" : "py-3"
                      } ${
                        selectedAssignmentId === row.id
                          ? "bg-cyan-500/15"
                          : "bg-slate-900/45"
                      }`}
                    >
                      {row.assignment_name}
                    </td>
                    <td className={`${isCompact ? "py-1.5" : "py-2.5"} pr-3`}>
                      {row.class_name}
                    </td>
                    <td className={`${isCompact ? "py-1.5" : "py-2.5"} pr-3`}>
                      <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] capitalize text-slate-200">
                        {row.assignment_type || "unspecified"}
                      </span>
                    </td>
                    <td className={`${isCompact ? "py-1.5" : "py-2.5"} pr-3`}>
                      {row.due_date
                        ? new Date(row.due_date).toLocaleDateString()
                        : "No due date"}
                    </td>
                    <td className={`${isCompact ? "py-1.5" : "py-2.5"} pr-4`}>
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                          row.archived_at
                            ? "border-slate-400/20 bg-slate-500/20 text-slate-200"
                            : row.completed
                              ? "border-emerald-400/25 bg-emerald-500/20 text-emerald-100"
                              : "border-cyan-400/25 bg-cyan-500/20 text-cyan-100"
                        }`}
                      >
                        {row.archived_at
                          ? "Archived"
                          : row.completed
                            ? "Completed"
                            : "Active"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-end gap-2 text-[11px] text-slate-500">
          <ArrowDownUp className="h-3 w-3" />
          Sorted by {sortLabel} ({sortDirection})
        </div>
      </div>

      {selectedAssignment && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setSelectedAssignmentId(null)}
        >
          <div
            className="w-full max-w-2xl rounded-3xl border border-white/10 bg-gradient-to-b from-slate-900 to-slate-950 p-5 shadow-[0_30px_80px_rgba(0,0,0,0.45)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-100">
                  Assignment details
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {selectedAssignment.assignment_name} ·{" "}
                  {selectedAssignment.class_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAssignmentId(null)}
                className="rounded-lg border border-white/20 bg-white/5 px-2 py-1 text-xs text-slate-200 transition hover:bg-white/10"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs text-slate-400">
                  Instructions
                </label>
                <textarea
                  value={detailsDraft.instructions}
                  onChange={(event) =>
                    setDetailsDraft((current) => ({
                      ...current,
                      instructions: event.target.value,
                    }))
                  }
                  rows={5}
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-100 focus:border-cyan-300 focus:outline-none"
                  placeholder="Paste assignment instructions here..."
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">
                  Guidelines
                </label>
                <textarea
                  value={detailsDraft.guidelines}
                  onChange={(event) =>
                    setDetailsDraft((current) => ({
                      ...current,
                      guidelines: event.target.value,
                    }))
                  }
                  rows={4}
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-100 focus:border-cyan-300 focus:outline-none"
                  placeholder="Rubric points, submission rules, style rules, etc."
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">
                  Personal notes
                </label>
                <textarea
                  value={detailsDraft.notes}
                  onChange={(event) =>
                    setDetailsDraft((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  rows={3}
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-100 focus:border-cyan-300 focus:outline-none"
                  placeholder="Anything you want Travis to remember for this assignment."
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={saveAssignmentDetails}
                  disabled={savingDetails}
                  className="rounded-xl border border-cyan-300/40 bg-cyan-500/20 px-3 py-2 text-xs text-cyan-100 transition hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingDetails ? "Saving..." : "Save details"}
                </button>
                <button
                  type="button"
                  onClick={passAssignmentToVictor}
                  className="rounded-lg border border-violet-300/40 bg-violet-500/20 px-3 py-2 text-xs text-violet-100 transition hover:bg-violet-500/30"
                >
                  Pass to Victor
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="academic-nested-card rounded-2xl p-6">
        <TravisSidebar />
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
