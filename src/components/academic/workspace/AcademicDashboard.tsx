"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { AssignmentRow } from "@/types/academic";
import { toLocalDateKey } from "@/lib/academic/dueDate";
import { useAcademicShellData } from "../shell/AcademicShellDataContext";
import AcademicEmptyState from "../shared/AcademicEmptyState";
import AcademicErrorState from "../shared/AcademicErrorState";
import AcademicLoadingState from "../shared/AcademicLoadingState";
import shared from "../shared/academic.module.css";

type AcademicWorkspaceView =
  | "dashboard"
  | "agenda"
  | "paper-workflow"
  | "assignments"
  | "syllabi"
  | "math-mode"
  | "coding-review";

function formatDateLabel(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function dueDaysLabel(
  value: number | null,
  t: (key: string, values?: Record<string, unknown>) => string
): string {
  if (value === null) return t("noDueDate");
  if (value < 0) return t("daysOverdue", { count: Math.abs(value) });
  if (value === 0) return t("dueToday");
  if (value === 1) return t("dueTomorrow");
  return t("daysLeft", { count: value });
}

function getDaysUntilDue(dueDate: string | null): number | null {
  if (!dueDate) return null;
  const due = new Date(`${dueDate}T00:00:00`);
  if (Number.isNaN(due.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function priorityRank(priority?: AssignmentRow["priority"]): number {
  switch (priority) {
    case "critical":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
    default:
      return 0;
  }
}

function getUrgentAssignment(assignments: AssignmentRow[]): AssignmentRow | null {
  const active = assignments
    .filter((assignment) => !assignment.completed && !assignment.archived_at && assignment.due_date)
    .sort((a, b) => {
      const dueA = new Date(`${a.due_date}T00:00:00`).getTime();
      const dueB = new Date(`${b.due_date}T00:00:00`).getTime();
      return dueA - dueB;
    });

  if (active.length === 0) return null;
  const next = active[0];
  const daysUntil = Math.ceil(
    (new Date(`${next.due_date}T00:00:00`).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  if (daysUntil <= 3 || next.status === "inbox") return next;
  return null;
}

function getUrgentAction(
  assignment: AssignmentRow,
  t: (key: string) => string
): { label: string; href: string } {
  switch (assignment.status) {
    case "inbox":
    case "planned":
      return { label: t("actions.startWorking"), href: `/academic/paper?assignmentId=${assignment.id}` };
    case "in_progress":
      return { label: t("actions.continue"), href: `/academic/paper?assignmentId=${assignment.id}` };
    case "ready_to_submit":
      return { label: t("actions.reviewAndSubmit"), href: `/academic/paper?assignmentId=${assignment.id}` };
    default:
      return { label: t("actions.open"), href: `/academic/paper?assignmentId=${assignment.id}` };
  }
}

function getTravisDashboardMessage(assignment: AssignmentRow, daysUntil: number): string {
  if (daysUntil <= 0) return `${assignment.assignment_name} is due today.`;
  if (daysUntil === 1) return `${assignment.assignment_name} is due tomorrow.`;
  return `${assignment.assignment_name} is coming up in ${daysUntil} days.`;
}

export default function AcademicDashboard({
  onNavigate: _onNavigate,
}: {
  onNavigate: (view: AcademicWorkspaceView) => void;
}) {
  const t = useTranslations("academic.workspace.dashboard");
  const router = useRouter();
  const {
    assignments: shellAssignments,
    assignmentsLoading: loading,
    assignmentsError: error,
  } = useAcademicShellData();
  const assignments = shellAssignments as AssignmentRow[];

  const now = useMemo(() => new Date(), []);
  const topPriority = useMemo(() => {
    return [...assignments]
      .filter((row) => row.status !== "submitted" && row.status !== "completed")
      .sort((a, b) => {
        const priorityDiff = priorityRank(b.priority) - priorityRank(a.priority);
        if (priorityDiff !== 0) return priorityDiff;
        const aDays = getDaysUntilDue(a.due_date) ?? Number.POSITIVE_INFINITY;
        const bDays = getDaysUntilDue(b.due_date) ?? Number.POSITIVE_INFINITY;
        return aDays - bDays;
      })
      .slice(0, 3);
  }, [assignments]);

  const urgentAssignment = useMemo(() => getUrgentAssignment(assignments), [assignments]);

  const atRiskCount = useMemo(
    () =>
      assignments.filter(
        (assignment) =>
          assignment.is_at_risk &&
          assignment.status !== "submitted" &&
          assignment.status !== "completed"
      ).length,
    [assignments]
  );

  const weekStart = useMemo(() => {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - day.getDay());
    return day;
  }, [now]);

  const weekRows = useMemo(() => {
    const rows = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + index);
      const key = toLocalDateKey(day);
      let planned = 0;
      let due = 0;
      assignments.forEach((assignment) => {
        const tasks = assignment.tasks || assignment.assignment_tasks || [];
        if (
          assignment.due_date &&
          toLocalDateKey(assignment.due_date) === key &&
          assignment.status !== "submitted" &&
          assignment.status !== "completed"
        ) {
          due += 1;
        }
        planned += tasks.filter(
          (task) =>
            task.status !== "complete" &&
            task.planned_date &&
            toLocalDateKey(task.planned_date as string) === key
        ).length;
      });
      return { key, day, planned, due };
    });
    return rows;
  }, [assignments, weekStart]);

  const plannedThisWeek = useMemo(
    () => weekRows.reduce((sum, row) => sum + row.planned, 0),
    [weekRows]
  );

  const tasksDueToday = useMemo(() => {
    const todayKey = toLocalDateKey(new Date());
    return assignments.reduce((sum, assignment) => {
      const tasks = assignment.tasks || assignment.assignment_tasks || [];
      return (
        sum +
        tasks.filter(
          (task) =>
            task.status !== "complete" &&
            task.planned_date &&
            toLocalDateKey(task.planned_date as string) === todayKey
        ).length
      );
    }, 0);
  }, [assignments]);

  return (
    <div className={`${shared.root} ${shared.page} mx-auto w-full max-w-[780px] space-y-5`}>
      {urgentAssignment ? (
        <div className={shared.surfacePanel}>
          <p className="text-sm text-slate-300">
            {getTravisDashboardMessage(
              urgentAssignment,
              getDaysUntilDue(urgentAssignment.due_date) ?? 0
            )}
          </p>
          <h2 className="mt-2 text-lg font-semibold text-slate-100">
            {urgentAssignment.assignment_name}
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            {urgentAssignment.class_name} · {t("duePrefix")} {urgentAssignment.due_date || t("tbd")} ·{" "}
            {(urgentAssignment.status || "inbox").replaceAll("_", " ")}
          </p>
          <button
            type="button"
            onClick={() => router.push(getUrgentAction(urgentAssignment, t).href)}
            className={`mt-4 ${shared.buttonBase} ${shared.buttonPrimary}`}
          >
            {getUrgentAction(urgentAssignment, t).label}
          </button>
        </div>
      ) : null}

      <div className={shared.surfacePanel}>
        <h2 className="text-2xl font-semibold text-slate-100">
          {t("greeting")}
        </h2>
        <p className={`${shared.mutedText} mt-2`}>{formatDateLabel(now)}</p>
      </div>

      <div className={shared.surfacePanel}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-100">{t("priorityToday")}</p>
          <button
            type="button"
            onClick={() => router.push("/academic/agenda")}
            className={`${shared.buttonBase} ${shared.buttonGhost}`}
          >
            {t("viewAllInAgenda")}
          </button>
        </div>
        {loading ? (
          <AcademicLoadingState message={t("loadingPriorities")} className="!min-h-0 py-4" />
        ) : error ? (
          <AcademicErrorState message={error} className="!min-h-0 py-4" />
        ) : topPriority.length === 0 ? (
          <AcademicEmptyState
            title={t("noActiveAssignmentsTitle")}
            description={t("noActiveAssignmentsDescription")}
            className="!min-h-0 py-4"
          />
        ) : (
          <div className="mt-3 space-y-2">
            {topPriority.map((assignment) => {
              const days = getDaysUntilDue(assignment.due_date);
              return (
                <button
                  key={assignment.id}
                  type="button"
                  onClick={() => router.push(`/academic/agenda?assignmentId=${assignment.id}`)}
                  className={`w-full ${shared.surfacePanelCompact} text-left ${
                    assignment.is_at_risk ? "border-l-4 border-l-amber-400" : ""
                  }`}
                >
                  <p className="text-sm font-semibold text-slate-100">
                    {assignment.assignment_name}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {assignment.class_name} · {t("duePrefix")} {assignment.due_date || t("tbd")} ·{" "}
                    {(assignment.status || "inbox").replaceAll("_", " ")} ·{" "}
                    {dueDaysLabel(days, t)}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className={shared.surfacePanel}>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
          <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-amber-100">
            {atRiskCount} at risk
          </span>
          <span className="rounded-full border border-sky-400/30 bg-sky-500/10 px-2 py-1 text-sky-100">
            {plannedThisWeek} planned this week
          </span>
          <span className="rounded-full border border-teal-400/30 bg-teal-500/10 px-2 py-1 text-teal-100">
            {tasksDueToday} tasks due today
          </span>
          <button
            type="button"
            onClick={() => router.push("/academic/agenda")}
            className={`ml-auto ${shared.buttonBase} ${shared.buttonSecondary}`}
          >
            {t("openAgenda")}
          </button>
        </div>
      </div>

      <div className={shared.surfacePanel}>
        <p className="text-sm font-semibold text-slate-100">{t("weeklyDigest")}</p>
        {weekRows.every((row) => row.planned === 0 && row.due === 0) ? (
          <AcademicEmptyState
            title={t("noTasksScheduledTitle")}
            description={t("noTasksScheduledDescription")}
            className="!min-h-0 py-4"
          />
        ) : (
          <div className="mt-3 space-y-2">
            {weekRows.map((row) => (
              <div
                key={row.key}
                className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs"
              >
                <span className="text-slate-300">
                  {row.day.toLocaleDateString(undefined, { weekday: "short" })}
                </span>
                <span className="text-slate-400">
                  {row.planned} planned · {row.due} due
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
