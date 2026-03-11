"use client";

import type { AssignmentRow } from "@/types/academic-studio";
import WeeklyView from "../travis-sidebar/components/WeeklyView";
import shared from "../shared/academic-studio.module.css";
import type { AgendaLeftColumnProps } from "./hooks/useAcademicAgendaShell";
import AcademicEmptyState from "../shared/AcademicEmptyState";
import AcademicErrorState from "../shared/AcademicErrorState";
import AcademicLoadingState from "../shared/AcademicLoadingState";
import TravisReminderPanel from "../travis-reminders/TravisReminderPanel";

type TaskStatus = "pending" | "in_progress" | "complete";

function formatDueDate(date: string | null): string {
  if (!date) return "No due date";
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "No due date";
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

function daysUntilLabel(daysUntilDue: number | null): string {
  if (daysUntilDue === null) return "No deadline";
  if (daysUntilDue < 0) return `${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) === 1 ? "" : "s"} overdue`;
  if (daysUntilDue === 0) return "Due today";
  if (daysUntilDue === 1) return "Due tomorrow";
  return `${daysUntilDue} days left`;
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
              {assignment.class_name} · Due {formatDueDate(assignment.due_date)} · {daysUntilLabel(dueIn)}
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
            <option value="inbox">Inbox</option>
            <option value="planned">Planned</option>
            <option value="in_progress">In progress</option>
            <option value="ready_to_submit">Ready to submit</option>
            <option value="submitted">Submitted</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Progress</span>
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
              Travis can break this down →
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
            {assignment.syllabus_id ? `From: ${assignment.class_name} syllabus` : "Added manually"}
          </span>
          <button
            type="button"
            onClick={() => onAskTravis(`Help me plan "${assignment.assignment_name}" for ${assignment.class_name}.`)}
            className={`${shared.buttonBase} ${shared.buttonSecondary}`}
          >
            Ask Travis
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
          Day
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
          Week
        </button>
      </div>

      {atRiskCount > 0 && (
        <div className={shared.surfacePanelCompact}>
          <p className="text-xs text-amber-100">
            Travis flagged {atRiskCount} assignment{atRiskCount === 1 ? "" : "s"} that need attention.{" "}
            <button
              type="button"
              onClick={() => onAskTravis("What is at risk right now?")}
              className="text-amber-50 underline underline-offset-2"
            >
              Review with Travis
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
            Since yesterday
          </button>
          {showChangesDigest ? (
            <div className="space-y-1 border-t border-white/10 px-3 py-2 text-xs text-slate-400">
              {digestLoading ? <p>Loading updates...</p> : null}
              {changeDigest.statusChanged.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-slate-300">{changeDigest.statusChanged.length} assignments changed status.</p>
                  {changeDigest.statusChanged.slice(0, 5).map((row) => (
                    <p key={row.id}>
                      {(row.assignments?.assignment_name || "Assignment")}: {(row.old_data?.status || "unknown").replaceAll("_", " ")}
                      {" -> "}
                      {(row.new_data?.status || "unknown").replaceAll("_", " ")}
                    </p>
                  ))}
                </div>
              ) : null}
              {changeDigest.completedTasks.length > 0 ? (
                <div className="space-y-1 pt-1">
                  <p className="text-slate-300">{changeDigest.completedTasks.length} tasks were completed.</p>
                  {changeDigest.completedTasks.slice(0, 5).map((task) => (
                    <p key={task.id}>
                      {task.assignments?.assignment_name || "Assignment"}: {task.label || task.task_type}
                    </p>
                  ))}
                </div>
              ) : null}
              {changeDigest.newAssignments.length > 0 ? (
                <div className="space-y-1 pt-1">
                  <p className="text-slate-300">{changeDigest.newAssignments.length} assignments were added.</p>
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
            Showing {focusManyIds.length} selected assignment{focusManyIds.length === 1 ? "" : "s"} from Assignments tab.
          </span>
          <button type="button" onClick={clearFocusMany} className={`${shared.buttonBase} ${shared.buttonSecondary}`}>
            Clear filter
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
        <AcademicLoadingState message="Loading your agenda..." />
      ) : viewMode === "week" ? (
        <div className="space-y-4">
          {groupedWeekItems.map((group) => (
            <div key={group.key} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{dayLabel(group.key)}</p>
              {group.assignments.length > 0 ? (
                <div className="space-y-3">{group.assignments.map((assignment) => renderAssignmentCard(assignment))}</div>
              ) : (
                <AcademicEmptyState
                  title="Nothing planned for this day."
                  description="Ask Travis to schedule something."
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
              title="Nothing planned for this day."
              description="Pick another date or switch to week view."
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
          + Add assignment
        </button>
        {showQuickAdd ? (
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            <input
              value={quickAddDraft.class_name}
              onChange={(event) =>
                setQuickAddDraft({ ...quickAddDraft, class_name: event.target.value })
              }
              placeholder="Class name"
              className={shared.control}
            />
            <input
              value={quickAddDraft.assignment_name}
              onChange={(event) =>
                setQuickAddDraft({ ...quickAddDraft, assignment_name: event.target.value })
              }
              placeholder="Assignment name"
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
              placeholder="Type"
              className={shared.control}
            />
            <div className="md:col-span-2">
              <button
                type="button"
                disabled={creating}
                onClick={() => void createQuickAssignment()}
                className={`${shared.buttonBase} ${shared.buttonPrimary}`}
              >
                {creating ? "Adding..." : "Add to agenda"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
