import type { AssignmentRow } from "@/types/academic";

export type AssignmentStatus =
  | "inbox"
  | "planned"
  | "in_progress"
  | "ready_to_submit"
  | "submitted"
  | "completed";

export type Priority = "low" | "medium" | "high" | "critical";
export type GroupBy = "class" | "due" | "flat";
export type DueRange = "week" | "month" | "all";

export type AssignmentListRow = AssignmentRow & {
  syllabus_id: string | null;
  archived_at: string | null;
  updated_at?: string | null;
};

export type ChangeHistoryRow = {
  id: string;
  change_type: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changed_at: string;
};

export type DetailDraft = {
  assignment_name: string;
  class_name: string;
  assignment_type: string;
  due_date: string;
  priority: Priority;
  status: AssignmentStatus;
  grading_weight: string;
  notes: string;
};

export const STATUS_OPTIONS: AssignmentStatus[] = [
  "inbox",
  "planned",
  "in_progress",
  "ready_to_submit",
  "submitted",
  "completed",
];

export const PRIORITY_OPTIONS: Priority[] = ["critical", "high", "medium", "low"];

export type FilterChip = {
  key: string;
  label: string;
  onClear: () => void;
};
