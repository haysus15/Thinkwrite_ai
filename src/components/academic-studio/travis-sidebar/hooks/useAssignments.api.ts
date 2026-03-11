import type { AssignmentRow } from "@/types/academic-studio";
import type { ClassAccountabilityPlan } from "./travisShared";

type ClassPlanApiRow = {
  id?: string;
  class_name?: string;
  cadence?: "weekly" | "custom";
  due_weekday?: string;
  notes?: string | null;
};

function getErrorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === "object" && "error" in data) {
    const value = (data as { error?: unknown }).error;
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return fallback;
}

export async function fetchActiveAssignments(): Promise<AssignmentRow[]> {
  const response = await fetch("/api/travis/assignments/all?status=active");
  const data: unknown = await response.json();
  if (!response.ok) {
    throw new Error(getErrorMessage(data, "Failed to load assignments."));
  }
  if (!data || typeof data !== "object") return [];
  const assignments = (data as { assignments?: unknown }).assignments;
  return Array.isArray(assignments) ? (assignments as AssignmentRow[]) : [];
}

export async function fetchClassPlans(): Promise<ClassAccountabilityPlan[]> {
  const response = await fetch("/api/travis/class-plans");
  const data: unknown = await response.json();
  if (!response.ok) {
    throw new Error(getErrorMessage(data, "Failed to load class plans."));
  }

  const plansRaw = data && typeof data === "object" ? (data as { plans?: unknown }).plans : [];
  const plans = Array.isArray(plansRaw) ? (plansRaw as ClassPlanApiRow[]) : [];

  return plans
    .filter(
      (row): row is Required<Pick<ClassPlanApiRow, "class_name" | "cadence">> & ClassPlanApiRow =>
        Boolean(row?.class_name) && (row?.cadence === "weekly" || row?.cadence === "custom")
    )
    .map((row) => ({
      id: row.id,
      class_name: row.class_name,
      cadence: row.cadence,
      due_weekday: row.due_weekday || "Sunday",
      notes: typeof row.notes === "string" ? row.notes : "",
    }));
}

export async function putAssignmentUpdate(
  assignmentId: string,
  payload: Record<string, unknown>,
  fallback = "Failed to update assignment."
): Promise<void> {
  const response = await fetch(`/api/travis/assignment/update/${assignmentId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data: unknown = await response.json();
  if (!response.ok) {
    throw new Error(getErrorMessage(data, fallback));
  }
}

export async function deleteAssignmentById(assignmentId: string): Promise<void> {
  const response = await fetch(`/api/travis/assignment/delete/${assignmentId}`, {
    method: "DELETE",
  });
  const data: unknown = await response.json();
  if (!response.ok) {
    throw new Error(getErrorMessage(data, "Failed to remove assignment."));
  }
}

export async function completeAssignmentById(assignmentId: string): Promise<void> {
  const response = await fetch(`/api/travis/assignment/complete/${assignmentId}`, {
    method: "PUT",
  });
  const data: unknown = await response.json();
  if (!response.ok) {
    throw new Error(getErrorMessage(data, "Failed to complete assignment."));
  }
}

export async function createAssignmentRecord(payload: Record<string, unknown>): Promise<void> {
  const response = await fetch("/api/travis/assignment/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data: unknown = await response.json();
  if (!response.ok) {
    throw new Error(getErrorMessage(data, "Failed to create assignment."));
  }
}

export async function saveClassPlanRecord(payload: {
  class_name: string;
  cadence: "weekly" | "custom";
  due_weekday: string;
  notes: string;
}): Promise<void> {
  const response = await fetch("/api/travis/class-plans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data: unknown = await response.json();
  if (!response.ok) {
    throw new Error(getErrorMessage(data, "Failed to save class plan."));
  }
}

export async function removeClassPlanRecord(className: string): Promise<void> {
  const response = await fetch("/api/travis/class-plans", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ class_name: className }),
  });
  const data: unknown = await response.json();
  if (!response.ok) {
    throw new Error(getErrorMessage(data, "Failed to remove class plan."));
  }
}
