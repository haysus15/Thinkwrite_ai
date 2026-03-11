"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toLocalDateKey } from "@/lib/academic/dueDate";
import { getNextBestAction } from "@/lib/academic/travis/getNextBestAction";
import { useAssignments } from "../../travis-sidebar/hooks/useAssignments";
import { useTravisChat } from "../../travis-sidebar/hooks/useTravisChat";
import { groupByDay, statusCycle } from "./useAcademicAgendaShell.utils";
import {
  type AgendaLeftColumnProps,
  type AgendaRightColumnProps,
  type TaskStatus,
  type ViewMode,
} from "./useAcademicAgendaShell.types";

export type {
  AgendaLeftColumnProps,
  AgendaRightColumnProps,
  TaskStatus,
  ViewMode,
} from "./useAcademicAgendaShell.types";

export function useAcademicAgendaShell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const focusAssignmentId = searchParams.get("focus");
  const autoPlan = searchParams.get("autoplan") === "1";
  const promptFromQuery = searchParams.get("prompt");
  const focusMany = searchParams.get("focusMany");
  const queryWeekStart = searchParams.get("weekStart");
  const queryView = searchParams.get("view");
  const queryDay = searchParams.get("day");

  const assignments = useAssignments();
  const chat = useTravisChat({
    agendaItems: [
      ...assignments.upcomingAssignments,
      ...assignments.overdueAssignments,
    ],
  });

  const {
    loading,
    error,
    setError,
    upcomingAssignments,
    overdueAssignments,
    weeklyUpcomingAssignments,
    filteredWeeklyAssignments,
    selectedWeekStart,
    selectedWeekDayKey,
    setSelectedWeekStart,
    setSelectedWeekDayKey,
    weekCalendarDays,
    visibleMonthStart,
    monthGridDays,
    canGoPrevMonth,
    canGoNextMonth,
    goToMonth,
    canGoPrevWeek,
    canGoNextWeek,
    goToWeek,
    jumpToToday,
    todayDateKey,
    weeklyClassCount,
    calendarSignalByDate,
    loadAssignments,
  } = assignments;

  const {
    travisChatMessages,
    travisChatInput,
    travisChatLoading,
    pendingTravisAction,
    setTravisChatInput,
    sendTravisMessage,
    confirmPendingTravisAction,
    rejectPendingTravisAction,
  } = chat;

  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [taskSavingId, setTaskSavingId] = useState<string | null>(null);
  const [statusSavingId, setStatusSavingId] = useState<string | null>(null);
  const [showChangesDigest, setShowChangesDigest] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [focusManyIds, setFocusManyIds] = useState<string[]>([]);
  const [digestLoading, setDigestLoading] = useState(false);
  const [digestData, setDigestData] = useState<{
    status_changes: Array<{
      id: string;
      assignment_id: string;
      changed_at: string;
      old_data?: { status?: string };
      new_data?: { status?: string };
      assignments?: { assignment_name?: string } | null;
    }>;
    completed_tasks: Array<{
      id: string;
      completed_at: string;
      label: string | null;
      task_type: string;
      assignments?: { assignment_name?: string } | null;
    }>;
    new_assignments: Array<{
      id: string;
      assignment_name: string;
      created_at: string;
    }>;
  }>({
    status_changes: [],
    completed_tasks: [],
    new_assignments: [],
  });
  const [creating, setCreating] = useState(false);
  const [nextBestAction, setNextBestAction] = useState<{
    label: string;
    rationale: string;
    toolTrigger: string | null;
    assignmentId: string | null;
  } | null>(null);
  const [quickAddDraft, setQuickAddDraftState] = useState({
    class_name: "",
    assignment_name: "",
    due_date: "",
    assignment_type: "",
  });
  const focusedCardRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sessionKey = "academic:agenda-opened";
    const hasOpenedThisSession = window.sessionStorage.getItem(sessionKey) === "1";
    if (!hasOpenedThisSession) {
      setViewMode("day");
      setSelectedWeekDayKey(todayDateKey);
      window.sessionStorage.setItem(sessionKey, "1");
    }
  }, [setSelectedWeekDayKey, todayDateKey]);

  useEffect(() => {
    if (!queryWeekStart) return;
    const parsed = new Date(`${queryWeekStart}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return;
    setSelectedWeekStart(parsed);
  }, [queryWeekStart, setSelectedWeekStart]);

  useEffect(() => {
    if (queryView === "day" || queryView === "week") {
      setViewMode(queryView);
    }
  }, [queryView]);

  useEffect(() => {
    if (!queryDay) return;
    setSelectedWeekDayKey(queryDay);
  }, [queryDay, setSelectedWeekDayKey]);

  useEffect(() => {
    if (!focusAssignmentId) return;
    let attempts = 0;
    let highlightTimeout = 0;
    let pollTimer = 0;
    const tryFocus = () => {
      const target = document.getElementById(`agenda-assignment-${focusAssignmentId}`);
      if (!target && attempts < 12) {
        attempts += 1;
        pollTimer = window.setTimeout(tryFocus, 120);
        return;
      }
      if (!target) return;
      focusedCardRef.current = target as HTMLElement;
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.classList.add("ring-2", "ring-sky-300/60");
      highlightTimeout = window.setTimeout(() => {
        target.classList.remove("ring-2", "ring-sky-300/60");
      }, 1500);
    };
    tryFocus();
    if (autoPlan) {
      const focused = upcomingAssignments.find((assignment) => assignment.id === focusAssignmentId);
      if (focused) {
        const prompt = `Plan my ${focused.assignment_name} assignment`;
        setTravisChatInput(prompt);
        void sendTravisMessage(prompt, { assignmentId: focused.id });
      }
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("focus");
    url.searchParams.delete("autoplan");
    window.history.replaceState({}, "", url.toString());
    return () => {
      window.clearTimeout(highlightTimeout);
      window.clearTimeout(pollTimer);
    };
  }, [autoPlan, focusAssignmentId, upcomingAssignments, sendTravisMessage, setTravisChatInput]);

  useEffect(() => {
    if (!promptFromQuery) return;
    setTravisChatInput(promptFromQuery);
    const url = new URL(window.location.href);
    url.searchParams.delete("prompt");
    window.history.replaceState({}, "", url.toString());
  }, [promptFromQuery, setTravisChatInput]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const weekStart = toLocalDateKey(selectedWeekStart);
    url.searchParams.set("weekStart", weekStart);
    url.searchParams.set("view", viewMode);
    url.searchParams.set("day", selectedWeekDayKey);
    window.history.replaceState({}, "", url.toString());
    window.dispatchEvent(
      new CustomEvent("academic:week-change", { detail: { weekStart } })
    );
  }, [selectedWeekStart, selectedWeekDayKey, viewMode]);

  useEffect(() => {
    if (!focusMany) return;
    const ids = focusMany.split(",").filter(Boolean);
    setFocusManyIds(ids);
    setViewMode("week");
    setSelectedWeekDayKey("all");
    if (ids.length === 0) return;
    const first = ids[0];
    const target = document.getElementById(`agenda-assignment-${first}`);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.classList.add("ring-2", "ring-sky-300/60");
      window.setTimeout(() => target.classList.remove("ring-2", "ring-sky-300/60"), 1500);
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("focusMany");
    window.history.replaceState({}, "", url.toString());
  }, [focusMany, setSelectedWeekDayKey]);

  useEffect(() => {
    let active = true;
    setDigestLoading(true);
    fetch("/api/travis/changes/since?hours=24")
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        setDigestData({
          status_changes: Array.isArray(data?.status_changes) ? data.status_changes : [],
          completed_tasks: Array.isArray(data?.completed_tasks) ? data.completed_tasks : [],
          new_assignments: Array.isArray(data?.new_assignments) ? data.new_assignments : [],
        });
      })
      .catch(() => {
        if (!active) return;
        setDigestData({
          status_changes: [],
          completed_tasks: [],
          new_assignments: [],
        });
      })
      .finally(() => {
        if (!active) return;
        setDigestLoading(false);
      });
    return () => {
      active = false;
    };
  }, [upcomingAssignments.length]);

  useEffect(() => {
    let active = true;
    void getNextBestAction(upcomingAssignments, new Date()).then((action) => {
      if (!active) return;
      setNextBestAction(action);
    });
    return () => {
      active = false;
    };
  }, [upcomingAssignments]);

  const plannedThisWeekCount = useMemo(
    () =>
      weeklyUpcomingAssignments.reduce((sum, assignment) => {
        const tasks = assignment.tasks || assignment.assignment_tasks || [];
        return (
          sum +
          tasks.filter(
            (task) =>
              task.status !== "complete" &&
              task.planned_date &&
              weekCalendarDays.some(
                (day) => toLocalDateKey(day) === toLocalDateKey(task.planned_date as string)
              )
          ).length
        );
      }, 0),
    [weeklyUpcomingAssignments, weekCalendarDays]
  );

  const tasksDueTodayCount = useMemo(
    () =>
      upcomingAssignments.filter((assignment) => {
        const tasks = assignment.tasks || assignment.assignment_tasks || [];
        return tasks.some(
          (task) =>
            task.status !== "complete" &&
            task.planned_date &&
            toLocalDateKey(task.planned_date as string) === todayDateKey
        );
      }).length,
    [todayDateKey, upcomingAssignments]
  );

  const atRiskCount = useMemo(
    () =>
      upcomingAssignments.filter(
        (assignment) =>
          assignment.is_at_risk &&
          assignment.status !== "submitted" &&
          assignment.status !== "completed"
      ).length,
    [upcomingAssignments]
  );

  const weekKeys = useMemo(
    () => weekCalendarDays.map((day) => toLocalDateKey(day)),
    [weekCalendarDays]
  );

  const agendaItemsForDisplay = useMemo(() => {
    const base = selectedWeekDayKey === "all" ? weeklyUpcomingAssignments : filteredWeeklyAssignments;
    if (focusManyIds.length === 0) return base;
    return base.filter((assignment) => focusManyIds.includes(assignment.id));
  }, [filteredWeeklyAssignments, focusManyIds, selectedWeekDayKey, weeklyUpcomingAssignments]);

  const groupedWeekItems = useMemo(
    () =>
      groupByDay(
        focusManyIds.length === 0
          ? weeklyUpcomingAssignments
          : weeklyUpcomingAssignments.filter((assignment) => focusManyIds.includes(assignment.id)),
        weekKeys
      ),
    [focusManyIds, weekKeys, weeklyUpcomingAssignments]
  );

  const changeDigest = useMemo(
    () => ({
      statusChanged: digestData.status_changes,
      completedTasks: digestData.completed_tasks,
      newAssignments: digestData.new_assignments,
    }),
    [digestData]
  );

  const onTaskToggle = async (
    assignmentId: string,
    taskId: string,
    currentStatus: TaskStatus
  ) => {
    setTaskSavingId(taskId);
    setError(null);
    try {
      const response = await fetch(`/api/assignments/${assignmentId}/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: statusCycle(currentStatus) }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not update task status.");
      }
      await loadAssignments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update task status.");
    } finally {
      setTaskSavingId(null);
    }
  };

  const onStatusUpdate = async (
    assignmentId: string,
    status: "inbox" | "planned" | "in_progress" | "ready_to_submit" | "submitted" | "completed"
  ) => {
    setStatusSavingId(assignmentId);
    setError(null);
    try {
      const response = await fetch(`/api/travis/assignment/update/${assignmentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not update assignment status.");
      }
      if (data.needs_plan_prompt) {
        setTravisChatInput(
          "Plan this assignment into research, outline, draft, revise, and submit steps."
        );
      }
      await loadAssignments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update assignment status.");
    } finally {
      setStatusSavingId(null);
    }
  };

  const createQuickAssignment = async () => {
    if (!quickAddDraft.class_name.trim() || !quickAddDraft.assignment_name.trim()) {
      setError("Class name and assignment name are required.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const response = await fetch("/api/travis/assignment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          class_name: quickAddDraft.class_name.trim(),
          assignment_name: quickAddDraft.assignment_name.trim(),
          due_date: quickAddDraft.due_date || null,
          assignment_type: quickAddDraft.assignment_type || null,
          status: "inbox",
          syllabus_id: null,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not create assignment.");
      }
      setQuickAddDraftState({
        class_name: "",
        assignment_name: "",
        due_date: "",
        assignment_type: "",
      });
      setShowQuickAdd(false);
      await loadAssignments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create assignment.");
    } finally {
      setCreating(false);
    }
  };

  return {
    leftColumnProps: {
      viewMode,
      setViewMode,
      selectedWeekDayKey,
      setSelectedWeekDayKey,
      todayDateKey,
      weeklyUpcomingAssignments,
      weeklyClassCount,
      overdueAssignments,
      visibleMonthStart,
      canGoPrevMonth,
      canGoNextMonth,
      goToMonth,
      selectedWeekStart,
      jumpToToday,
      monthGridDays,
      calendarSignalByDate,
      weekCalendarDays,
      setSelectedWeekStart,
      canGoPrevWeek,
      canGoNextWeek,
      goToWeek,
      atRiskCount,
      showChangesDigest,
      setShowChangesDigest: (next: boolean) => setShowChangesDigest(next),
      digestLoading,
      changeDigest,
      focusManyIds,
      clearFocusMany: () => setFocusManyIds([]),
      error,
      loading,
      groupedWeekItems,
      agendaItemsForDisplay,
      taskSavingId,
      statusSavingId,
      onTaskToggle,
      onStatusUpdate,
      onAskTravis: (prompt: string) => setTravisChatInput(prompt),
      showQuickAdd,
      setShowQuickAdd: (next: boolean) => setShowQuickAdd(next),
      quickAddDraft,
      setQuickAddDraft: (next) => setQuickAddDraftState(next),
      creating,
      createQuickAssignment,
    } satisfies AgendaLeftColumnProps,
    rightColumnProps: {
      atRiskCount,
      plannedThisWeekCount,
      tasksDueTodayCount,
      travisChatMessages,
      pendingTravisAction,
      travisChatInput,
      setTravisChatInput,
      travisChatLoading,
      sendTravisMessage,
      confirmPendingTravisAction,
      rejectPendingTravisAction,
      nextBestAction,
    } satisfies AgendaRightColumnProps,
    router,
  };
}
