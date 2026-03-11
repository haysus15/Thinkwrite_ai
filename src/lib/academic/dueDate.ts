const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function normalizeDueDateInput(
  value: string | null | undefined
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const dateOnlyMatch = trimmed.match(DATE_ONLY_RE);
  if (dateOnlyMatch) return trimmed;

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dueDateToMs(value: string | null | undefined): number {
  if (!value) return Number.NaN;
  const normalized = normalizeDueDateInput(value);
  if (!normalized || normalized === undefined) return Number.NaN;
  return Date.parse(`${normalized}T00:00:00Z`);
}

export function toDateInputValue(value: string | null | undefined): string {
  const normalized = normalizeDueDateInput(value);
  if (!normalized || normalized === undefined) return "";
  return normalized;
}

export function formatDueDate(value: string | null | undefined): string {
  const normalized = normalizeDueDateInput(value);
  if (!normalized || normalized === undefined) return "No due date";
  const date = new Date(`${normalized}T00:00:00`);
  return date.toLocaleDateString();
}

export function todayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function toLocalDateKey(value: string | Date): string {
  if (typeof value === "string") {
    const normalized = normalizeDueDateInput(value);
    if (normalized && normalized !== undefined) return normalized;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

