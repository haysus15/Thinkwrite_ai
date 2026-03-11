import { toLocalDateKey } from "@/lib/academic/dueDate";
import type { AssignmentRow } from "@/types/academic-studio";
import type { TaskStatus } from "./useAcademicAgendaShell.types";

export function statusCycle(status: TaskStatus): TaskStatus {
  if (status === "pending") return "in_progress";
  if (status === "in_progress") return "complete";
  return "pending";
}

export function groupByDay(
  assignments: AssignmentRow[],
  weekKeys: string[]
): Array<{ key: string; assignments: AssignmentRow[] }> {
  return weekKeys.map((key) => ({
    key,
    assignments: assignments.filter((assignment) => {
      const taskDays = (assignment.tasks || assignment.assignment_tasks || [])
        .filter((task) => task.status !== "complete" && task.planned_date)
        .map((task) => toLocalDateKey(task.planned_date as string));
      const dueKey = assignment.due_date ? toLocalDateKey(assignment.due_date) : "";
      return taskDays.includes(key) || dueKey === key;
    }),
  }));
}
