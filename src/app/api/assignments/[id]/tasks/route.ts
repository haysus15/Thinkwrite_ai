import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeDueDateInput } from "@/lib/academic/dueDate";

type TaskType = "research" | "outline" | "draft" | "revise" | "submit" | "other";
type TaskStatus = "pending" | "in_progress" | "complete";

const VALID_TASK_TYPES = new Set<TaskType>([
  "research",
  "outline",
  "draft",
  "revise",
  "submit",
  "other",
]);

const VALID_TASK_STATUSES = new Set<TaskStatus>([
  "pending",
  "in_progress",
  "complete",
]);

async function ensureAssignmentOwnership(assignmentId: string, userId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("assignments")
    .select("id")
    .eq("id", assignmentId)
    .eq("user_id", userId)
    .is("archived_at", null)
    .single();

  if (error || !data) return false;
  return true;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const ownsAssignment = await ensureAssignmentOwnership(params.id, userId);
  if (!ownsAssignment) {
    return NextResponse.json(
      { success: false, error: "Assignment not found." },
      { status: 404 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error: fetchError } = await supabase
    .from("assignment_tasks")
    .select(
      "id, task_type, label, status, planned_date, completed_at, sort_order, created_at, updated_at"
    )
    .eq("assignment_id", params.id)
    .eq("user_id", userId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (fetchError) {
    return NextResponse.json(
      { success: false, error: fetchError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, tasks: data || [] }, { status: 200 });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const ownsAssignment = await ensureAssignmentOwnership(params.id, userId);
  if (!ownsAssignment) {
    return NextResponse.json(
      { success: false, error: "Assignment not found." },
      { status: 404 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const inputTasks = Array.isArray(body?.tasks) ? body.tasks : body ? [body] : [];
  if (inputTasks.length === 0) {
    return NextResponse.json(
      { success: false, error: "At least one task is required." },
      { status: 400 }
    );
  }

  const payload = inputTasks.map((task: any, index: number) => {
    const taskType = String(task?.task_type || "").trim() as TaskType;
    const status = String(task?.status || "pending").trim() as TaskStatus;
    if (!VALID_TASK_TYPES.has(taskType)) {
      throw new Error(`Invalid task_type: ${taskType}`);
    }
    if (!VALID_TASK_STATUSES.has(status)) {
      throw new Error(`Invalid status: ${status}`);
    }

    const plannedDate = normalizeDueDateInput(task?.planned_date);
    return {
      assignment_id: params.id,
      user_id: userId,
      task_type: taskType,
      label: typeof task?.label === "string" ? task.label.trim() : null,
      status,
      planned_date: plannedDate ?? null,
      completed_at: status === "complete" ? new Date().toISOString() : null,
      sort_order:
        typeof task?.sort_order === "number" && Number.isFinite(task.sort_order)
          ? task.sort_order
          : index,
    };
  });

  const supabase = await createSupabaseServerClient();
  try {
    const { data, error: insertError } = await supabase
      .from("assignment_tasks")
      .insert(payload)
      .select(
        "id, task_type, label, status, planned_date, completed_at, sort_order, created_at, updated_at"
      );

    if (insertError) {
      return NextResponse.json(
        { success: false, error: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, tasks: data || [] }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to create task(s).",
      },
      { status: 400 }
    );
  }
}

