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

async function getOwnedTask(
  assignmentId: string,
  taskId: string,
  userId: string
) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("assignment_tasks")
    .select("id, assignment_id, user_id, status")
    .eq("id", taskId)
    .eq("assignment_id", assignmentId)
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;
  return data;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; taskId: string }> }
) {
  const params = await context.params;
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const existing = await getOwnedTask(params.id, params.taskId, userId);
  if (!existing) {
    return NextResponse.json(
      { success: false, error: "Task not found." },
      { status: 404 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};

  if (body?.task_type !== undefined) {
    const taskType = String(body.task_type).trim() as TaskType;
    if (!VALID_TASK_TYPES.has(taskType)) {
      return NextResponse.json(
        { success: false, error: "Invalid task type." },
        { status: 400 }
      );
    }
    updates.task_type = taskType;
  }

  if (body?.label !== undefined) {
    updates.label = typeof body.label === "string" ? body.label.trim() : null;
  }

  if (body?.planned_date !== undefined) {
    updates.planned_date = normalizeDueDateInput(body.planned_date) ?? null;
  }

  if (body?.sort_order !== undefined) {
    const sortOrder = Number(body.sort_order);
    if (!Number.isFinite(sortOrder)) {
      return NextResponse.json(
        { success: false, error: "sort_order must be a number." },
        { status: 400 }
      );
    }
    updates.sort_order = sortOrder;
  }

  if (body?.status !== undefined) {
    const status = String(body.status).trim() as TaskStatus;
    if (!VALID_TASK_STATUSES.has(status)) {
      return NextResponse.json(
        { success: false, error: "Invalid task status." },
        { status: 400 }
      );
    }
    updates.status = status;
    updates.completed_at = status === "complete" ? new Date().toISOString() : null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { success: false, error: "No valid fields to update." },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error: updateError } = await supabase
    .from("assignment_tasks")
    .update(updates)
    .eq("id", params.taskId)
    .eq("assignment_id", params.id)
    .eq("user_id", userId)
    .select(
      "id, task_type, label, status, planned_date, completed_at, sort_order, created_at, updated_at"
    )
    .single();

  if (updateError || !data) {
    return NextResponse.json(
      { success: false, error: updateError?.message || "Failed to update task." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, task: data }, { status: 200 });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string; taskId: string }> }
) {
  const params = await context.params;
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const existing = await getOwnedTask(params.id, params.taskId, userId);
  if (!existing) {
    return NextResponse.json(
      { success: false, error: "Task not found." },
      { status: 404 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error: deleteError } = await supabase
    .from("assignment_tasks")
    .delete()
    .eq("id", params.taskId)
    .eq("assignment_id", params.id)
    .eq("user_id", userId);

  if (deleteError) {
    return NextResponse.json(
      { success: false, error: deleteError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true }, { status: 200 });
}

