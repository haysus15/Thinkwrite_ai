import type { AssignmentRow } from "@/types/academic-studio";
import type { AssignmentListRow, GroupBy } from "./assignmentsWorkspaceTypes";

export function titleCaseStatus(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function priorityBorder(priority?: AssignmentRow["priority"]): string {
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

export function daysUntilDue(date: string | null): number | null {
  if (!date) return null;
  const due = new Date(`${date}T00:00:00`);
  if (Number.isNaN(due.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function dueLabel(days: number | null): string {
  if (days === null) return "No due date";
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `${days} days left`;
}

export function groupedAssignments(rows: AssignmentListRow[], groupBy: GroupBy) {
  if (groupBy === "flat") {
    return [{ key: "All assignments", rows }];
  }
  if (groupBy === "due") {
    const map = new Map<string, AssignmentListRow[]>();
    rows.forEach((row) => {
      const key = row.due_date || "No due date";
      const list = map.get(key) || [];
      list.push(row);
      map.set(key, list);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, values]) => ({ key, rows: values }));
  }
  const map = new Map<string, AssignmentListRow[]>();
  rows.forEach((row) => {
    const key = row.class_name || "Uncategorized";
    const list = map.get(key) || [];
    list.push(row);
    map.set(key, list);
  });
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, values]) => ({ key, rows: values }));
}
