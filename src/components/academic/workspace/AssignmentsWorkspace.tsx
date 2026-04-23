"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import AcademicEmptyState from "../shared/AcademicEmptyState";
import AcademicErrorState from "../shared/AcademicErrorState";
import AcademicLoadingState from "../shared/AcademicLoadingState";
import shared from "../shared/academic.module.css";
import AssignmentDetailDrawer from "./AssignmentDetailDrawer";
import AssignmentsBulkActions from "./AssignmentsBulkActions";
import AssignmentsFilters from "./AssignmentsFilters";
import AssignmentsGroupsList from "./AssignmentsGroupsList";
import {
  type AssignmentListRow,
  type AssignmentStatus,
  type ChangeHistoryRow,
  type DetailDraft,
  type DueRange,
  type FilterChip,
  type GroupBy,
  type Priority,
} from "./assignmentsWorkspaceTypes";
import { daysUntilDue, groupedAssignments, titleCaseStatus } from "./assignmentsWorkspaceUtils";

export default function AssignmentsWorkspace() {
  const t = useTranslations("academic.workspace.assignments");
  const router = useRouter();
  const searchParams = useSearchParams();
  const syllabusIdFromUrl = searchParams.get("syllabusId");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<AssignmentListRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [historyRows, setHistoryRows] = useState<ChangeHistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [taskUpdatingId, setTaskUpdatingId] = useState<string | null>(null);
  const [detailSaving, setDetailSaving] = useState(false);
  const [menuOpenForId, setMenuOpenForId] = useState<string | null>(null);
  const [detailDraft, setDetailDraft] = useState<DetailDraft>({
    assignment_name: "",
    class_name: "",
    assignment_type: "",
    due_date: "",
    priority: "medium",
    status: "inbox",
    grading_weight: "",
    notes: "",
  });

  const [classFilter, setClassFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<AssignmentStatus[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<Priority[]>([]);
  const [dueRange, setDueRange] = useState<DueRange>("all");
  const [searchText, setSearchText] = useState("");
  const [groupBy, setGroupBy] = useState<GroupBy>("class");

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/travis/assignments/all?status=all");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || t("errors.loadAssignments"));
      }
      setRows((data.assignments || []) as AssignmentListRow[]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("errors.loadAssignments")
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const classes = useMemo(
    () =>
      Array.from(new Set(rows.map((row) => row.class_name).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [rows]
  );

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (syllabusIdFromUrl && row.syllabus_id !== syllabusIdFromUrl) return false;
      if (classFilter !== "all" && row.class_name !== classFilter) return false;
      const status = (row.status || (row.completed ? "completed" : "inbox")) as AssignmentStatus;
      if (statusFilter.length > 0 && !statusFilter.includes(status)) return false;
      const priority = (row.priority || "medium") as Priority;
      if (priorityFilter.length > 0 && !priorityFilter.includes(priority)) return false;

      if (dueRange !== "all") {
        const days = daysUntilDue(row.due_date);
        if (days === null) return false;
        if (dueRange === "week" && (days < 0 || days > 7)) return false;
        if (dueRange === "month" && (days < 0 || days > 31)) return false;
      }

      if (searchText.trim()) {
        const q = searchText.trim().toLowerCase();
        const haystack = `${row.assignment_name} ${row.class_name}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [rows, syllabusIdFromUrl, classFilter, statusFilter, priorityFilter, dueRange, searchText]);

  const groups = useMemo(() => groupedAssignments(filteredRows, groupBy), [filteredRows, groupBy]);

  const selectedAssignment = useMemo(
    () => rows.find((row) => row.id === selectedAssignmentId) || null,
    [rows, selectedAssignmentId]
  );

  const fetchHistory = useCallback(async (assignmentId: string) => {
    setHistoryLoading(true);
    try {
      const response = await fetch(`/api/travis/assignment/${assignmentId}/history`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || t("errors.loadChangeHistory"));
      }
      setHistoryRows((data.history || []) as ChangeHistoryRow[]);
    } catch {
      setHistoryRows([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const openDetail = async (assignmentId: string) => {
    const row = rows.find((item) => item.id === assignmentId);
    if (row) {
      setDetailDraft({
        assignment_name: row.assignment_name || "",
        class_name: row.class_name || "",
        assignment_type: row.assignment_type || "",
        due_date: row.due_date || "",
        priority: (row.priority || "medium") as Priority,
        status: (row.status || (row.completed ? "completed" : "inbox")) as AssignmentStatus,
        grading_weight: typeof row.grading_weight === "number" ? String(row.grading_weight) : "",
        notes: row.notes || "",
      });
    }

    setSelectedAssignmentId(assignmentId);
    await fetchHistory(assignmentId);
  };

  const saveDetailPanel = async () => {
    if (!selectedAssignment) return;
    setDetailSaving(true);
    setError(null);

    try {
      const parsedWeight = Number(detailDraft.grading_weight);
      const response = await fetch(`/api/travis/assignment/update/${selectedAssignment.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          assignment_name: detailDraft.assignment_name.trim(),
          class_name: detailDraft.class_name.trim(),
          assignment_type: detailDraft.assignment_type.trim() || null,
          due_date: detailDraft.due_date || null,
          priority: detailDraft.priority,
          status: detailDraft.status,
          grading_weight:
            detailDraft.grading_weight.trim() === ""
              ? null
              : Number.isFinite(parsedWeight)
                ? parsedWeight
                : null,
          notes: detailDraft.notes.trim() || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || t("errors.saveAssignmentDetails"));
      }
      await loadRows();
      await fetchHistory(selectedAssignment.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.saveAssignmentDetails"));
    } finally {
      setDetailSaving(false);
    }
  };

  const updateAssignment = async (
    assignmentId: string,
    payload: Partial<{ status: AssignmentStatus; priority: Priority }>
  ) => {
    setUpdatingId(assignmentId);
    setError(null);
    try {
      const response = await fetch(`/api/travis/assignment/update/${assignmentId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t("errors.update"));
      await loadRows();
      if (selectedAssignmentId === assignmentId) {
        await fetchHistory(assignmentId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.update"));
    } finally {
      setUpdatingId(null);
    }
  };

  const updateTaskStatus = async (
    assignmentId: string,
    taskId: string,
    current: "pending" | "in_progress" | "complete"
  ) => {
    const next =
      current === "pending" ? "in_progress" : current === "in_progress" ? "complete" : "pending";
    setTaskUpdatingId(taskId);
    setError(null);
    try {
      const response = await fetch(`/api/assignments/${assignmentId}/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t("errors.taskUpdate"));
      await loadRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.taskUpdate"));
    } finally {
      setTaskUpdatingId(null);
    }
  };

  const toggleSelect = (assignmentId: string) => {
    setSelectedIds((current) =>
      current.includes(assignmentId)
        ? current.filter((id) => id !== assignmentId)
        : [...current, assignmentId]
    );
  };

  const applyBulkStatus = async (status: AssignmentStatus) => {
    for (const id of selectedIds) {
      await updateAssignment(id, { status });
    }
  };

  const applyBulkPriority = async (priority: Priority) => {
    for (const id of selectedIds) {
      await updateAssignment(id, { priority });
    }
  };

  const archiveSelected = async () => {
    for (const id of selectedIds) {
      await fetch(`/api/travis/assignment/delete/${id}`, { method: "DELETE" });
    }
    setSelectedIds([]);
    await loadRows();
  };

  const archiveSingle = async (assignmentId: string) => {
    setError(null);
    try {
      const response = await fetch(`/api/travis/assignment/delete/${assignmentId}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t("errors.archive"));
      setMenuOpenForId(null);
      if (selectedAssignmentId === assignmentId) {
        setSelectedAssignmentId(null);
      }
      await loadRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.archive"));
    }
  };

  const goPlanInAgenda = (assignmentId: string, options?: { autoPlan?: boolean; prompt?: string }) => {
    const url = new URL("/academic/agenda", window.location.origin);
    url.searchParams.set("focus", assignmentId);
    if (options?.autoPlan) url.searchParams.set("autoplan", "1");
    if (options?.prompt) url.searchParams.set("prompt", options.prompt);
    router.push(`${url.pathname}${url.search}`);
  };

  const activeFilterChips: FilterChip[] = [
    classFilter !== "all"
      ? { key: "class", label: t("chips.class", { value: classFilter }), onClear: () => setClassFilter("all") }
      : null,
    statusFilter.length
      ? {
          key: "status",
          label: t("chips.status", { value: statusFilter.map(titleCaseStatus).join(", ") }),
          onClear: () => setStatusFilter([]),
        }
      : null,
    priorityFilter.length
      ? {
          key: "priority",
          label: t("chips.priority", { value: priorityFilter.join(", ") }),
          onClear: () => setPriorityFilter([]),
        }
      : null,
    dueRange !== "all"
      ? { key: "dueRange", label: t("chips.due", { value: dueRange }), onClear: () => setDueRange("all") }
      : null,
    searchText.trim()
      ? { key: "search", label: t("chips.search", { value: searchText.trim() }), onClear: () => setSearchText("") }
      : null,
  ].filter(Boolean) as FilterChip[];

  return (
    <div className={`${shared.root} ${shared.page} space-y-5`}>
      <div className={shared.surfacePanel}>
        <p className={shared.panelTitle}>{t("title")}</p>
        <p className={shared.panelBody}>
          {t("description")}
        </p>
      </div>

      <AssignmentsFilters
        classes={classes}
        classFilter={classFilter}
        dueRange={dueRange}
        searchText={searchText}
        groupBy={groupBy}
        statusFilter={statusFilter}
        priorityFilter={priorityFilter}
        activeFilterChips={activeFilterChips}
        setClassFilter={(value) => setClassFilter(value)}
        setDueRange={(value) => setDueRange(value)}
        setSearchText={(value) => setSearchText(value)}
        setGroupBy={(value) => setGroupBy(value)}
        setStatusFilter={(updater) => setStatusFilter(updater)}
        setPriorityFilter={(updater) => setPriorityFilter(updater)}
      />

      <AssignmentsBulkActions
        selectedIds={selectedIds}
        applyBulkStatus={applyBulkStatus}
        applyBulkPriority={applyBulkPriority}
        archiveSelected={archiveSelected}
      />

      {loading ? (
        <div className={shared.surfacePanel}>
          <AcademicLoadingState message={t("loading")} className="!min-h-0 py-4" />
        </div>
      ) : groups.length === 0 || filteredRows.length === 0 ? (
        <div className={shared.surfacePanel}>
          <AcademicEmptyState
            title={t("emptyTitle")}
            description={t("emptyDescription")}
            className="!min-h-0 py-4"
            action={{
              label: t("clearFilters"),
              onClick: () => {
                setClassFilter("all");
                setStatusFilter([]);
                setPriorityFilter([]);
                setDueRange("all");
                setSearchText("");
              },
            }}
          />
        </div>
      ) : (
        <AssignmentsGroupsList
          groups={groups}
          selectedIds={selectedIds}
          updatingId={updatingId}
          menuOpenForId={menuOpenForId}
          setMenuOpenForId={setMenuOpenForId}
          toggleSelect={toggleSelect}
          openDetail={openDetail}
          updateAssignment={updateAssignment}
          archiveSingle={archiveSingle}
          goPlanInAgenda={goPlanInAgenda}
        />
      )}

      <AssignmentDetailDrawer
        selectedAssignment={selectedAssignment}
        detailDraft={detailDraft}
        setDetailDraft={setDetailDraft}
        detailSaving={detailSaving}
        saveDetailPanel={saveDetailPanel}
        taskUpdatingId={taskUpdatingId}
        updateTaskStatus={updateTaskStatus}
        historyLoading={historyLoading}
        historyRows={historyRows}
        onClose={() => setSelectedAssignmentId(null)}
        goPlanInAgenda={goPlanInAgenda}
      />

      {error ? (
        <AcademicErrorState
          message={error}
          className="!min-h-0 border-red-500/40 bg-red-500/10 py-4"
          retry={() => {
            void loadRows();
          }}
        />
      ) : null}
    </div>
  );
}
