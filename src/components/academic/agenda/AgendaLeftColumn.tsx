"use client";

import { useTranslations } from "next-intl";
import type { AssignmentRow } from "@/types/academic";
import WeeklyView from "../travis-sidebar/components/WeeklyView";
import shared from "../shared/academic.module.css";
import type { AgendaLeftColumnProps } from "./hooks/useAcademicAgendaShell";
import AcademicEmptyState from "../shared/AcademicEmptyState";
import AcademicErrorState from "../shared/AcademicErrorState";
import AcademicLoadingState from "../shared/AcademicLoadingState";
import TravisReminderPanel from "../travis-reminders/TravisReminderPanel";

type TaskStatus = "pending" | "in_progress" | "complete";

function formatDueDate(date: string | null, t: (key: string, values?: Record<string, unknown>) => string): string {
  if (!date) return t("noDueDate");
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return t("noDueDate");
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function computeDaysUntilDue(date: string | null): number | null {
  if (!date) return null;
  const due = new Date(`${date}T00:00:00`);
  if (Number.isNaN(due.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function daysUntilLabel(
  daysUntilDue: number | null,
  t: (key: string, values?: Record<string, unknown>) => string
): string {
  if (daysUntilDue === null) return t("noDeadline");
  if (daysUntilDue < 0) return t("daysOverdue", { count: Math.abs(daysUntilDue) });
  if (daysUntilDue === 0) return t("dueToday");
  if (daysUntilDue === 1) return t("dueTomorrow");
  return t("daysLeft", { count: daysUntilDue });
}

function taskStatusClass(status: TaskStatus): string {
  if (status === "complete") return "border-emerald-300/60 bg-emerald-500/25";
  if (status === "in_progress") return "border-amber-300/60 bg-amber-500/25";
  return "border-white/20 bg-white/[0.04]";
}

function priorityBorder(priority?: AssignmentRow["priority"]): string {
  switch (priority) {
    case "critical":
      return "border-l-red-400";
    case "high":
      return "border-l-amber-400";
    case "low":
      return "border-l-slate-500";
    case "medium":
    default:
      return "border-l-sky-400";
  }
}

function dayLabel(key: string): string {
  const parsed = new Date(`${key}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return key;
  return parsed.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function AgendaLeftColumn(props: AgendaLeftColumnProps) {
  const t = useTranslations("academic.agendaUi.left");
  const {
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
    setShowChangesDigest,
    digestLoading,
    changeDigest,
    focusManyIds,
    clearFocusMany,
    error,
    loading,
    groupedWeekItems,
    agendaItemsForDisplay,
    taskSavingId,
    statusSavingId,
    onTaskToggle,
    onStatusUpdate,
    onAskTravis,
    showQuickAdd,
    setShowQuickAdd,
    quickAddDraft,
    setQuickAddDraft,
    creating,
    createQuickAssignment,
  } = props;

  const renderAssignmentCard = (assignment: AssignmentRow) => {
    const tasks = assignment.tasks || assignment.assignment_tasks || [];
    const progress =
      typeof assignment.progress_percent === "number"
        ? assignment.progress_percent
        : tasks.length === 0
          ? 0
          : Math.round(
              (tasks.filter((task) => task.status === "complete").length / tasks.length) * 100
            );
    const dueIn =
      typeof assignment.days_until_due === "number"
        ? assignment.days_until_due
        : computeDaysUntilDue(assignment.due_date);

    return (
      <article
        id={`agenda-assignment-${assignment.id}`}
        key={assignment.id}
        className={`${shared.surfacePanelCompact} border-l-4 ${priorityBorder(assignment.priority)}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-100">{assignment.assignment_name}</p>
            <p className="mt-1 text-xs text-slate-400">
              {assignment.class_name} · {t("duePrefix")} {formatDueDate(assignment.due_date, t)} · {daysUntilLabel(dueIn, t)}
            </p>
          </div>
          <select
            value={assignment.status || "inbox"}
            onChange={(event) =>
              void onStatusUpdate(
                assignment.id,
                event.target.value as
                  | "inbox"
                  | "planned"
                  | "in_progress"
                  | "ready_to_submit"
                  | "submitted"
                  | "completed"
              )
            }
            disabled={statusSavingId === assignment.id}
            className={shared.control}
          >
            <option value="inbox">{t("statuses.inbox")}</option>
            <option value="planned">{t("statuses.planned")}</option>
            <option value="in_progress">{t("statuses.inProgress")}</option>
            <option value="ready_to_submit">{t("statuses.readyToSubmit")}</option>
            <option value="submitted">{t("statuses.submitted")}</option>
            <option value="completed">{t("statuses.completed")}</option>
          </select>
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>{t("progress")}</span>
            <span>{progress}%</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-black/30">
            <div className="h-2 rounded-full bg-sky-400/70 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="mt-3">
          {tasks.length === 0 && (assignment.status || "inbox") === "inbox" ? (
            <button
              type="button"
              onClick={() => onAskTravis(`Break down "${assignment.assignment_name}" for ${assignment.class_name}.`)}
              className={`${shared.buttonBase} ${shared.buttonGhost}`}
            >
              {t("breakDown")}
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {tasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  disabled={taskSavingId === task.id}
                  onClick={() =>
                    void onTaskToggle(assignment.id, task.id, task.status as TaskStatus)
                  }
                  className={`rounded-full border px-2.5 py-1 text-[11px] text-slate-100 transition ${taskStatusClass(task.status as TaskStatus)}`}
                >
                  {task.task_type}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-3 flex justify-end">
          <span className={`mr-auto ${shared.mutedText}`}>
            {assignment.syllabus_id ? t("fromSyllabus", { className: assignment.class_name }) : t("addedManually")}
          </span>
          <button
            type="button"
            onClick={() => onAskTravis(`Help me plan "${assignment.assignment_name}" for ${assignment.class_name}.`)}
            className={`${shared.buttonBase} ${shared.buttonSecondary}`}
          >
            {t("askTravis")}
          </button>
        </div>
      </article>
    );
  };

  return (
    <section className="space-y-4 lg:col-span-3">
      <TravisReminderPanel mode="inline" />

      <WeeklyView
        weeklyUpcomingAssignmentsLength={weeklyUpcomingAssignments.length}
        weeklyClassCount={weeklyClassCount}
        overdueAssignmentsLength={overdueAssignments.length}
        visibleMonthStart={visibleMonthStart}
        canGoPrevMonth={canGoPrevMonth}
        canGoNextMonth={canGoNextMonth}
        goToMonth={goToMonth}
        selectedWeekStart={selectedWeekStart}
        jumpToToday={jumpToToday}
        monthGridDays={monthGridDays}
        calendarSignalByDate={calendarSignalByDate}
        selectedWeekDayKey={selectedWeekDayKey}
        todayDateKey={todayDateKey}
        weekCalendarDays={weekCalendarDays}
        setSelectedWeekStart={setSelectedWeekStart}
        setSelectedWeekDayKey={setSelectedWeekDayKey}
        canGoPrevWeek={canGoPrevWeek}
        canGoNextWeek={canGoNextWeek}
        goToWeek={goToWeek}
      />

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setViewMode("day");
            if (selectedWeekDayKey === "all") setSelectedWeekDayKey(todayDateKey);
          }}
          className={`${shared.buttonBase} ${
            viewMode === "day"
              ? "border-sky-400/45 bg-sky-500/20 text-sky-100"
              : `${shared.buttonSecondary}`
          }`}
        >
          {t("day")}
        </button>
        <button
          type="button"
          onClick={() => {
            setViewMode("week");
            setSelectedWeekDayKey("all");
          }}
          className={`${shared.buttonBase} ${
            viewMode === "week"
              ? "border-sky-400/45 bg-sky-500/20 text-sky-100"
              : `${shared.buttonSecondary}`
          }`}
        >
          {t("week")}
        </button>
      </div>

      {atRiskCount > 0 && (
        <div className={shared.surfacePanelCompact}>
          <p className="text-xs text-amber-100">
            {t("atRiskNotice", { count: atRiskCount })}{" "}
            <button
              type="button"
              onClick={() => onAskTravis(t("prompts.whatAtRisk"))}
              className="text-amber-50 underline underline-offset-2"
            >
              {t("reviewWithTravis")}
            </button>
          </p>
        </div>
      )}

      {(changeDigest.statusChanged.length > 0 ||
        changeDigest.completedTasks.length > 0 ||
        changeDigest.newAssignments.length > 0) && (
        <div className={shared.surfacePanelCompact}>
          <button
            type="button"
            onClick={() => setShowChangesDigest(!showChangesDigest)}
            className="w-full text-left text-xs text-slate-200"
          >
            {t("sinceYesterday")}
          </button>
          {showChangesDigest ? (
            <div className="space-y-1 border-t border-white/10 px-3 py-2 text-xs text-slate-400">
              {digestLoading ? <p>{t("loadingUpdates")}</p> : null}
              {changeDigest.statusChanged.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-slate-300">{t("assignmentsChangedStatus", { count: changeDigest.statusChanged.length })}</p>
                  {changeDigest.statusChanged.slice(0, 5).map((row) => (
                    <p key={row.id}>
                      {(row.assignments?.assignment_name || t("assignmentFallback"))}: {(row.old_data?.status || "unknown").replaceAll("_", " ")}
                      {" -> "}
                      {(row.new_data?.status || "unknown").replaceAll("_", " ")}
                    </p>
                  ))}
                </div>
              ) : null}
              {changeDigest.completedTasks.length > 0 ? (
                <div className="space-y-1 pt-1">
                  <p className="text-slate-300">{t("tasksCompleted", { count: changeDigest.completedTasks.length })}</p>
                  {changeDigest.completedTasks.slice(0, 5).map((task) => (
                    <p key={task.id}>
                      {task.assignments?.assignment_name || t("assignmentFallback")}: {task.label || task.task_type}
                    </p>
                  ))}
                </div>
              ) : null}
              {changeDigest.newAssignments.length > 0 ? (
                <div className="space-y-1 pt-1">
                  <p className="text-slate-300">{t("assignmentsAdded", { count: changeDigest.newAssignments.length })}</p>
                  {changeDigest.newAssignments.slice(0, 5).map((row) => (
                    <p key={row.id}>{row.assignment_name}</p>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
      {focusManyIds.length > 0 ? (
        <div className={`${shared.surfacePanelCompact} flex items-center justify-between text-xs text-sky-100`}>
          <span>
            {t("showingSelectedAssignments", { count: focusManyIds.length })}
          </span>
          <button type="button" onClick={clearFocusMany} className={`${shared.buttonBase} ${shared.buttonSecondary}`}>
            {t("clearFilter")}
          </button>
        </div>
      ) : null}

      {error && (
        <AcademicErrorState
          message={error}
          className="!min-h-0 border-red-500/40 bg-red-500/10 py-4"
        />
      )}

      {loading ? (
        <AcademicLoadingState message={t("loadingAgenda")} />
      ) : viewMode === "week" ? (
        <div className="space-y-4">
          {groupedWeekItems.map((group) => (
            <div key={group.key} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{dayLabel(group.key)}</p>
              {group.assignments.length > 0 ? (
                <div className="space-y-3">{group.assignments.map((assignment) => renderAssignmentCard(assignment))}</div>
              ) : (
                <AcademicEmptyState
                  title={t("nothingPlannedTitle")}
                  description={t("nothingPlannedDescription")}
                />
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {agendaItemsForDisplay.length > 0 ? (
            agendaItemsForDisplay.map((assignment) => renderAssignmentCard(assignment))
          ) : (
            <AcademicEmptyState
              title={t("nothingPlannedTitle")}
              description={t("pickAnotherDate")}
            />
          )}
        </div>
      )}

      <div className={shared.surfacePanelCompact}>
        <button
          type="button"
          onClick={() => setShowQuickAdd(!showQuickAdd)}
          className={`${shared.buttonBase} ${shared.buttonGhost}`}
        >
          {t("addAssignment")}
        </button>
        {showQuickAdd ? (
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            <input
              value={quickAddDraft.class_name}
              onChange={(event) =>
                setQuickAddDraft({ ...quickAddDraft, class_name: event.target.value })
              }
              placeholder={t("placeholders.className")}
              className={shared.control}
            />
            <input
              value={quickAddDraft.assignment_name}
              onChange={(event) =>
                setQuickAddDraft({ ...quickAddDraft, assignment_name: event.target.value })
              }
              placeholder={t("placeholders.assignmentName")}
              className={shared.control}
            />
            <input
              type="date"
              value={quickAddDraft.due_date}
              onChange={(event) =>
                setQuickAddDraft({ ...quickAddDraft, due_date: event.target.value })
              }
              className={shared.control}
            />
            <input
              value={quickAddDraft.assignment_type}
              onChange={(event) =>
                setQuickAddDraft({ ...quickAddDraft, assignment_type: event.target.value })
              }
              placeholder={t("placeholders.type")}
              className={shared.control}
            />
            <div className="md:col-span-2">
              <button
                type="button"
              disabled={creating}
              onClick={() => void createQuickAssignment()}
              className={`${shared.buttonBase} ${shared.buttonPrimary}`}
            >
              {creating ? t("adding") : t("addToAgenda")}
            </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
