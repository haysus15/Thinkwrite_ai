const ALLOWED_ASSIGNMENT_TYPES = new Set([
  "test",
  "quiz",
  "paper",
  "homework",
  "lab",
  "project",
  "reading",
]);

export function normalizeAssignmentType(
  value: string | null | undefined,
  fallbackTitle?: string | null
): string | null {
  const normalized = (value || "").trim().toLowerCase();
  if (normalized && ALLOWED_ASSIGNMENT_TYPES.has(normalized)) {
    return normalized;
  }

  // Map common parser labels to the constrained DB enum/check set.
  if (normalized === "discussion") return "homework";
  if (normalized === "milestone") return "project";
  if (normalized === "assignment") return "homework";

  const title = (fallbackTitle || "").toLowerCase();
  if (title.includes("milestone")) return "project";
  if (title.includes("discussion")) return "homework";
  if (title.includes("project")) return "project";
  if (title.includes("lab")) return "lab";
  if (title.includes("quiz")) return "quiz";
  if (title.includes("test") || title.includes("exam")) return "test";
  if (title.includes("paper") || title.includes("essay")) return "paper";
  if (title.includes("read")) return "reading";

  return "homework";
}

export function isAllowedAssignmentType(value: string | null | undefined) {
  if (!value) return false;
  return ALLOWED_ASSIGNMENT_TYPES.has(value.trim().toLowerCase());
}
