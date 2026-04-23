import { dueDateToMs, toLocalDateKey } from "@/lib/academic/dueDate";
import type { AssignmentRow } from "@/types/academic";

export const toIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const toMidnight = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

export const fromDateKey = (key: string): Date | null => {
  const [year, month, day] = key.split("-").map((part) => Number(part));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  const date = new Date(year, month - 1, day, 0, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const getAssignmentScheduleKeys = (assignment: AssignmentRow): string[] => {
  const keys = new Set<string>();
  const tasks = assignment.tasks || assignment.assignment_tasks || [];

  if (assignment.agenda_date) {
    const agendaKey = toLocalDateKey(assignment.agenda_date);
    if (agendaKey) keys.add(agendaKey);
  }

  tasks.forEach((task) => {
    if (task.status === "complete") return;
    if (!task.planned_date) return;
    const taskKey = toLocalDateKey(task.planned_date);
    if (taskKey) keys.add(taskKey);
  });

  if (assignment.due_date) {
    const dueKey = toLocalDateKey(assignment.due_date);
    if (dueKey) keys.add(dueKey);
  }

  return Array.from(keys);
};

export function splitAssignmentsByDue(allAssignments: AssignmentRow[], nowMs: number) {
  const isClosed = (assignment: AssignmentRow) =>
    assignment.status === "submitted" || assignment.status === "completed";

  const overdue = allAssignments
    .filter((assignment) => {
      if (isClosed(assignment)) return false;
      if (!assignment.due_date) return false;
      const due = dueDateToMs(assignment.due_date);
      return !Number.isNaN(due) && due < nowMs;
    })
    .sort((a, b) => {
      const aDue = a.due_date ? dueDateToMs(a.due_date) : Number.POSITIVE_INFINITY;
      const bDue = b.due_date ? dueDateToMs(b.due_date) : Number.POSITIVE_INFINITY;
      return aDue - bDue;
    });

  const upcoming = allAssignments
    .filter((assignment) => {
      if (isClosed(assignment)) return false;
      if (!assignment.due_date) return true;
      const due = dueDateToMs(assignment.due_date);
      return !Number.isNaN(due) && due >= nowMs;
    })
    .sort((a, b) => {
      const aDue = a.due_date ? dueDateToMs(a.due_date) : Number.POSITIVE_INFINITY;
      const bDue = b.due_date ? dueDateToMs(b.due_date) : Number.POSITIVE_INFINITY;
      return aDue - bDue;
    });

  return { overdue, upcoming };
}

export function collapsedClassState(rows: AssignmentRow[]): Record<string, boolean> {
  const classes = Array.from(new Set(rows.map((row) => row.class_name || "Uncategorized")));
  return classes.reduce<Record<string, boolean>>((acc, className) => {
    acc[className] = false;
    return acc;
  }, {});
}

export function calendarSignals(upcomingAssignments: AssignmentRow[]) {
  const signals: Record<string, "overdue" | "due_today" | "planned"> = {};
  const todayKey = toLocalDateKey(new Date());
  const todayDate = fromDateKey(todayKey);

  const setSignal = (key: string, signal: "overdue" | "due_today" | "planned") => {
    if (!key) return;
    const current = signals[key];
    if (current === "overdue") return;
    if (current === "due_today" && signal === "planned") return;
    signals[key] = signal;
  };

  upcomingAssignments.forEach((assignment) => {
    const assignmentStatus = assignment.status || (assignment.completed ? "completed" : "inbox");
    if (assignmentStatus === "completed" || assignmentStatus === "submitted") return;

    const dueKey = assignment.due_date ? toLocalDateKey(assignment.due_date) : "";
    const dueDate = dueKey ? fromDateKey(dueKey) : null;

    if (dueKey && dueDate && todayDate) {
      if (dueKey === todayKey) {
        setSignal(dueKey, "due_today");
      } else if (dueDate.getTime() < todayDate.getTime()) {
        setSignal(dueKey, "overdue");
      }
    }

    const tasks = assignment.tasks || assignment.assignment_tasks || [];
    tasks.forEach((task) => {
      if (task.status === "complete") return;
      if (!task.planned_date) return;
      const taskKey = toLocalDateKey(task.planned_date);
      if (!taskKey) return;
      setSignal(taskKey, "planned");
    });
  });

  return signals;
}
