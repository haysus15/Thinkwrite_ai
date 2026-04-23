import type { AssignmentRow } from "@/types/academic";

export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export const CODING_TYPES = new Set(["lab", "project", "homework"]);
export const CODING_KEYWORDS = [
  "code",
  "coding",
  "programming",
  "python",
  "javascript",
  "sql",
  "algorithm",
  "data structure",
  "database",
  "query",
  "function",
  "class",
  "loop",
  "debug",
  "compile",
];

export type ClassAccountabilityPlan = {
  id?: string;
  class_name: string;
  cadence: "weekly" | "custom";
  due_weekday: string;
  notes: string;
};

export const addDays = (date: Date, count: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + count);
  return next;
};

export const startOfWeek = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  const day = next.getDay();
  next.setDate(next.getDate() - day);
  return next;
};

export const isCodingAssignment = (assignment: AssignmentRow) => {
  const type = (assignment.assignment_type || "").toLowerCase();
  if (!CODING_TYPES.has(type)) return false;

  const haystack = [
    assignment.assignment_name,
    assignment.class_name,
    JSON.stringify(assignment.requirements || {}),
  ]
    .join(" ")
    .toLowerCase();

  return CODING_KEYWORDS.some((kw) => haystack.includes(kw));
};

export const toGuidancePreview = (assignment: AssignmentRow) => {
  const instructions =
    typeof assignment.requirements?.instructions === "string"
      ? assignment.requirements.instructions.trim()
      : "";
  const guidelines =
    typeof assignment.requirements?.guidelines === "string"
      ? assignment.requirements.guidelines.trim()
      : "";
  const notes = typeof assignment.notes === "string" ? assignment.notes.trim() : "";

  const text = [instructions, guidelines, notes].filter(Boolean).join(" ");
  if (!text) return null;
  if (text.length <= 180) return text;
  return `${text.slice(0, 177)}...`;
};
