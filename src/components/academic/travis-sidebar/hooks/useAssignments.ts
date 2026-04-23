"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AssignmentRow } from "@/types/academic";
import { toDateInputValue, toLocalDateKey } from "@/lib/academic/dueDate";
import { addDays, startOfWeek } from "./travisShared";
import type { ClassAccountabilityPlan } from "./travisShared";
import {
  completeAssignmentById,
  createAssignmentRecord,
  deleteAssignmentById,
  fetchActiveAssignments,
  fetchClassPlans,
  putAssignmentUpdate,
  removeClassPlanRecord,
  saveClassPlanRecord,
} from "./useAssignments.api";
import {
  calendarSignals,
  collapsedClassState,
  getAssignmentScheduleKeys,
  splitAssignmentsByDue,
  toIsoDate,
  toMidnight,
} from "./useAssignments.utils";

export function useAssignments(options: {
  runReminderEvaluation?: () => Promise<void> | void;
} = {}) {
  const { runReminderEvaluation } = options;

  const today = useMemo(() => new Date(), []);
  const baseYear = today.getFullYear();

  const [upcomingAssignments, setUpcomingAssignments] = useState<AssignmentRow[]>([]);
  const [overdueAssignments, setOverdueAssignments] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedClasses, setExpandedClasses] = useState<Record<string, boolean>>({});
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState({
    assignment_name: "",
    class_name: "",
    assignment_type: "",
    due_date: "",
    agenda_date: "",
    reason: "",
  });
  const [showAddAssignmentForm, setShowAddAssignmentForm] = useState(false);
  const [creatingAssignment, setCreatingAssignment] = useState(false);
  const [newAssignmentDraft, setNewAssignmentDraft] = useState({
    assignment_name: "",
    class_name: "",
    assignment_type: "",
    due_date: "",
    agenda_date: "",
    grading_weight: "",
  });
  const [showAccountabilityForm, setShowAccountabilityForm] = useState(false);
  const [classPlans, setClassPlans] = useState<ClassAccountabilityPlan[]>([]);
  const [planDraft, setPlanDraft] = useState<ClassAccountabilityPlan>({
    class_name: "",
    cadence: "weekly",
    due_weekday: "Sunday",
    notes: "",
  });
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [selectedWeekDayKey, setSelectedWeekDayKey] = useState<string>("all");

  const minWeekStart = useMemo(() => startOfWeek(new Date(baseYear - 2, 0, 1)), [baseYear]);
  const maxWeekStart = useMemo(() => startOfWeek(new Date(baseYear + 3, 11, 31)), [baseYear]);

  const loadAssignments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const allAssignments = await fetchActiveAssignments();
      const { upcoming, overdue } = splitAssignmentsByDue(allAssignments, Date.now());

      setUpcomingAssignments(upcoming);
      setOverdueAssignments(overdue);
      setExpandedClasses(collapsedClassState(upcoming));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load assignments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAssignments();
  }, [loadAssignments]);

  const loadClassPlans = useCallback(async () => {
    try {
      const plans = await fetchClassPlans();
      setClassPlans(plans);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load class plans.");
    }
  }, []);

  useEffect(() => {
    void loadClassPlans();
  }, [loadClassPlans]);

  const startEditingAssignment = useCallback((assignment: AssignmentRow) => {
    setEditingAssignmentId(assignment.id);
    setEditingDraft({
      assignment_name: assignment.assignment_name || "",
      class_name: assignment.class_name || "",
      assignment_type: assignment.assignment_type || "",
      due_date: toDateInputValue(assignment.due_date),
      agenda_date: toDateInputValue(assignment.agenda_date || null),
      reason: "",
    });
  }, []);

  const cancelEditingAssignment = useCallback(() => {
    setEditingAssignmentId(null);
    setEditingDraft({
      assignment_name: "",
      class_name: "",
      assignment_type: "",
      due_date: "",
      agenda_date: "",
      reason: "",
    });
  }, []);

  const saveAssignmentEdit = useCallback(
    async (assignmentId: string) => {
      setError(null);
      try {
        await putAssignmentUpdate(
          assignmentId,
          {
            assignment_name: editingDraft.assignment_name.trim(),
            class_name: editingDraft.class_name.trim(),
            assignment_type: editingDraft.assignment_type.trim() || null,
            due_date: editingDraft.due_date || null,
            agenda_date: editingDraft.agenda_date || null,
            reason: editingDraft.reason.trim() || null,
          },
          "Failed to update assignment."
        );
        cancelEditingAssignment();
        await loadAssignments();
        await runReminderEvaluation?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update assignment.");
      }
    },
    [cancelEditingAssignment, editingDraft, loadAssignments, runReminderEvaluation]
  );

  const removeAssignment = useCallback(
    async (assignmentId: string) => {
      setError(null);
      try {
        await deleteAssignmentById(assignmentId);
        if (editingAssignmentId === assignmentId) {
          cancelEditingAssignment();
        }
        await loadAssignments();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to remove assignment.");
      }
    },
    [cancelEditingAssignment, editingAssignmentId, loadAssignments]
  );

  const markAssignmentComplete = useCallback(
    async (assignmentId: string) => {
      setError(null);
      try {
        await completeAssignmentById(assignmentId);
        if (editingAssignmentId === assignmentId) {
          cancelEditingAssignment();
        }
        await loadAssignments();
        await runReminderEvaluation?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to complete assignment.");
      }
    },
    [cancelEditingAssignment, editingAssignmentId, loadAssignments, runReminderEvaluation]
  );

  const setAssignmentAgendaDate = useCallback(
    async (assignmentId: string, agendaDate: string | null) => {
      setError(null);
      try {
        await putAssignmentUpdate(
          assignmentId,
          { agenda_date: agendaDate },
          "Failed to update planned date."
        );
        await loadAssignments();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update planned date.");
      }
    },
    [loadAssignments]
  );

  const setAssignmentAgendaDateBulk = useCallback(
    async (assignmentIds: string[], agendaDate: string) => {
      if (assignmentIds.length === 0) return;
      setError(null);
      try {
        await Promise.all(
          assignmentIds.map((assignmentId) =>
            putAssignmentUpdate(
              assignmentId,
              { agenda_date: agendaDate },
              "Failed to bulk plan assignments."
            )
          )
        );
        await loadAssignments();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to bulk plan assignments.");
      }
    },
    [loadAssignments]
  );

  const planAssignmentToday = useCallback(
    async (assignmentId: string) => setAssignmentAgendaDate(assignmentId, toIsoDate(new Date())),
    [setAssignmentAgendaDate]
  );
  const planAssignmentTomorrow = useCallback(
    async (assignmentId: string) =>
      setAssignmentAgendaDate(assignmentId, toIsoDate(addDays(new Date(), 1))),
    [setAssignmentAgendaDate]
  );
  const planAssignmentOnSelectedDay = useCallback(async (assignmentId: string) => {
    if (selectedWeekDayKey === "all") return;
    await setAssignmentAgendaDate(assignmentId, selectedWeekDayKey);
  }, [selectedWeekDayKey, setAssignmentAgendaDate]);
  const clearAssignmentPlanDate = useCallback(
    async (assignmentId: string) => setAssignmentAgendaDate(assignmentId, null),
    [setAssignmentAgendaDate]
  );
  const planAssignmentsForToday = useCallback(
    async (assignmentIds: string[]) => setAssignmentAgendaDateBulk(assignmentIds, toIsoDate(new Date())),
    [setAssignmentAgendaDateBulk]
  );
  const planAssignmentsForTomorrow = useCallback(
    async (assignmentIds: string[]) =>
      setAssignmentAgendaDateBulk(assignmentIds, toIsoDate(addDays(new Date(), 1))),
    [setAssignmentAgendaDateBulk]
  );

  const planAssignmentsForThisWeekend = useCallback(
    async (assignmentIds: string[]) => {
      const todayDate = toMidnight(new Date());
      const saturdayOffset = (6 - todayDate.getDay() + 7) % 7;
      const weekendTarget = saturdayOffset === 0 ? todayDate : addDays(todayDate, saturdayOffset);
      await setAssignmentAgendaDateBulk(assignmentIds, toIsoDate(weekendTarget));
    },
    [setAssignmentAgendaDateBulk]
  );

  const resetNewAssignmentDraft = useCallback(() => {
    setNewAssignmentDraft({
      assignment_name: "",
      class_name: "",
      assignment_type: "",
      due_date: "",
      agenda_date: "",
      grading_weight: "",
    });
  }, []);

  const createAssignment = useCallback(async () => {
    const assignmentName = newAssignmentDraft.assignment_name.trim();
    const className = newAssignmentDraft.class_name.trim();
    if (!assignmentName || !className) {
      setError("Assignment name and class are required.");
      return;
    }

    const parsedWeight = Number(newAssignmentDraft.grading_weight);
    setCreatingAssignment(true);
    setError(null);
    try {
      await createAssignmentRecord({
        assignment_name: assignmentName,
        class_name: className,
        assignment_type: newAssignmentDraft.assignment_type.trim() || null,
        due_date: newAssignmentDraft.due_date || null,
        agenda_date: newAssignmentDraft.agenda_date || null,
        grading_weight:
          newAssignmentDraft.grading_weight.trim() === ""
            ? null
            : Number.isFinite(parsedWeight)
              ? parsedWeight
              : null,
      });
      resetNewAssignmentDraft();
      setShowAddAssignmentForm(false);
      await loadAssignments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create assignment.");
    } finally {
      setCreatingAssignment(false);
    }
  }, [loadAssignments, newAssignmentDraft, resetNewAssignmentDraft]);

  const saveClassPlan = useCallback(async () => {
    const className = planDraft.class_name.trim();
    if (!className) {
      setError("Class name is required for accountability settings.");
      return;
    }

    setError(null);
    try {
      await saveClassPlanRecord({
        class_name: className,
        cadence: planDraft.cadence,
        due_weekday: planDraft.due_weekday || "Sunday",
        notes: planDraft.notes.trim(),
      });
      await loadClassPlans();
      setPlanDraft({
        class_name: "",
        cadence: "weekly",
        due_weekday: "Sunday",
        notes: "",
      });
      setShowAccountabilityForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save class plan.");
    }
  }, [loadClassPlans, planDraft]);

  const removeClassPlan = useCallback(
    async (className: string) => {
      setError(null);
      try {
        await removeClassPlanRecord(className);
        await loadClassPlans();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to remove class plan.");
      }
    },
    [loadClassPlans]
  );

  const goToWeek = useCallback(
    (offset: number) => {
      setSelectedWeekStart((current) => {
        const next = addDays(current, offset * 7);
        if (next.getTime() < minWeekStart.getTime()) return minWeekStart;
        if (next.getTime() > maxWeekStart.getTime()) return maxWeekStart;
        return next;
      });
      setSelectedWeekDayKey("all");
    },
    [maxWeekStart, minWeekStart]
  );

  const goToMonth = useCallback((offset: number) => {
    setSelectedWeekStart((current) =>
      startOfWeek(new Date(current.getFullYear(), current.getMonth() + offset, 1))
    );
    setSelectedWeekDayKey("all");
  }, []);

  const jumpToToday = useCallback(() => {
    const now = new Date();
    setSelectedWeekStart(startOfWeek(now));
    setSelectedWeekDayKey(toLocalDateKey(now));
  }, []);

  const weekCalendarDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(selectedWeekStart, index)),
    [selectedWeekStart]
  );
  const visibleMonthStart = useMemo(
    () => new Date(selectedWeekStart.getFullYear(), selectedWeekStart.getMonth(), 1),
    [selectedWeekStart]
  );
  const monthGridDays = useMemo(() => {
    const gridStart = startOfWeek(visibleMonthStart);
    return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  }, [visibleMonthStart]);

  const canGoPrevWeek = selectedWeekStart.getTime() > minWeekStart.getTime();
  const canGoNextWeek = selectedWeekStart.getTime() < maxWeekStart.getTime();
  const canGoPrevMonth = selectedWeekStart.getTime() > minWeekStart.getTime();
  const canGoNextMonth = selectedWeekStart.getTime() < maxWeekStart.getTime();

  const weeklyUpcomingAssignments = useMemo(() => {
    const weekKeys = new Set(
      Array.from({ length: 7 }, (_, index) => toLocalDateKey(addDays(selectedWeekStart, index)))
    );

    return upcomingAssignments.filter((assignment) => {
      const scheduleKeys = getAssignmentScheduleKeys(assignment);
      if (scheduleKeys.length === 0) return false;
      return scheduleKeys.some((key) => weekKeys.has(key));
    });
  }, [upcomingAssignments, selectedWeekStart]);

  const calendarSignalByDate = useMemo(() => calendarSignals(upcomingAssignments), [upcomingAssignments]);

  const unscheduledAssignments = useMemo(
    () =>
      upcomingAssignments.filter(
        (assignment) =>
          !assignment.agenda_date &&
          !assignment.due_date &&
          !(assignment.tasks || assignment.assignment_tasks || []).some(
            (task) => task.status !== "complete" && Boolean(task.planned_date)
          )
      ),
    [upcomingAssignments]
  );

  const filteredWeeklyAssignments = useMemo(() => {
    if (selectedWeekDayKey === "all") return weeklyUpcomingAssignments;
    return weeklyUpcomingAssignments.filter((assignment) => {
      return getAssignmentScheduleKeys(assignment).includes(selectedWeekDayKey);
    });
  }, [selectedWeekDayKey, weeklyUpcomingAssignments]);

  const upcomingByClass = useMemo(() => {
    const byClass = new Map<string, AssignmentRow[]>();
    filteredWeeklyAssignments.forEach((assignment) => {
      const className = assignment.class_name || "Uncategorized";
      const existing = byClass.get(className) || [];
      existing.push(assignment);
      byClass.set(className, existing);
    });
    return Array.from(byClass.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredWeeklyAssignments]);

  const weeklyClassCount = useMemo(() => new Set(filteredWeeklyAssignments.map((row) => row.class_name)).size, [filteredWeeklyAssignments]);
  const todayDateKey = useMemo(() => toLocalDateKey(new Date()), []);
  const classPlanByName = useMemo(() => classPlans.reduce<Record<string, ClassAccountabilityPlan>>((acc, row) => {
      acc[row.class_name.toLowerCase()] = row;
      return acc;
    }, {}), [classPlans]);

  return {
    upcomingAssignments, overdueAssignments, loading, error, expandedClasses,
    editingAssignmentId, editingDraft, showAddAssignmentForm, creatingAssignment, newAssignmentDraft,
    showAccountabilityForm, classPlans, planDraft, selectedWeekStart, selectedWeekDayKey,
    minWeekStart, maxWeekStart, weekCalendarDays, visibleMonthStart, monthGridDays,
    canGoPrevWeek, canGoNextWeek, canGoPrevMonth, canGoNextMonth, weeklyUpcomingAssignments,
    calendarSignalByDate, filteredWeeklyAssignments, unscheduledAssignments, upcomingByClass,
    weeklyClassCount, todayDateKey, classPlanByName, loadAssignments, setError, setExpandedClasses,
    setEditingDraft, setShowAddAssignmentForm, setShowAccountabilityForm, setNewAssignmentDraft,
    setPlanDraft, setSelectedWeekStart, setSelectedWeekDayKey, startEditingAssignment,
    cancelEditingAssignment, saveAssignmentEdit, removeAssignment, markAssignmentComplete,
    setAssignmentAgendaDate, setAssignmentAgendaDateBulk, planAssignmentToday,
    planAssignmentTomorrow, planAssignmentOnSelectedDay, clearAssignmentPlanDate,
    planAssignmentsForToday, planAssignmentsForTomorrow, planAssignmentsForThisWeekend,
    resetNewAssignmentDraft, createAssignment, saveClassPlan, removeClassPlan, goToWeek,
    goToMonth, jumpToToday,
  };
}
