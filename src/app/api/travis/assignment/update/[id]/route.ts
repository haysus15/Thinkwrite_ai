// src/app/api/travis/assignment/update/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeAssignmentType } from "@/lib/academic/assignmentType";
import { normalizeDueDateInput } from "@/lib/academic/dueDate";

function diffFields(
  current: Record<string, unknown>,
  next: Record<string, unknown>
) {
  const changes: Array<{ field: string; oldValue: string; newValue: string }> =
    [];
  Object.entries(next).forEach(([field, value]) => {
    if (value === undefined) return;
    const currentValue = current[field];
    const oldString = JSON.stringify(currentValue ?? null);
    const newString = JSON.stringify(value ?? null);
    if (oldString !== newString) {
      changes.push({
        field,
        oldValue: oldString,
        newValue: newString,
      });
    }
  });
  return changes;
}

export async function PUT(
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

  const body = await request.json();
  const reason = body?.reason || null;
  const nextStatus =
    body?.status === undefined
      ? undefined
      : String(body.status).trim();
  const nextPriority =
    body?.priority === undefined
      ? undefined
      : String(body.priority).trim();
  const VALID_STATUS = new Set([
    "inbox",
    "planned",
    "in_progress",
    "ready_to_submit",
    "submitted",
    "completed",
  ]);
  if (nextStatus !== undefined && !VALID_STATUS.has(nextStatus)) {
    return NextResponse.json(
      { success: false, error: "Invalid assignment status." },
      { status: 400 }
    );
  }
  const VALID_PRIORITY = new Set(["low", "medium", "high", "critical"]);
  if (nextPriority !== undefined && !VALID_PRIORITY.has(nextPriority)) {
    return NextResponse.json(
      { success: false, error: "Invalid assignment priority." },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: current, error: fetchError } = await supabase
    .from("assignments")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", userId)
    .single();

  if (fetchError || !current) {
    return NextResponse.json(
      { success: false, error: "Assignment not found." },
      { status: 404 }
    );
  }

  const updates: Record<string, unknown> = {
    class_name: body?.class_name,
    assignment_name: body?.assignment_name,
    assignment_type:
      body?.assignment_type === undefined
        ? undefined
        : normalizeAssignmentType(
            body?.assignment_type,
            body?.assignment_name || current.assignment_name
          ),
    due_date: normalizeDueDateInput(body?.due_date),
    agenda_date: normalizeDueDateInput(body?.agenda_date),
    requirements: body?.requirements,
    grading_weight: body?.grading_weight,
    notes: body?.notes,
    priority: nextPriority,
    status: nextStatus,
    completed:
      nextStatus === undefined
        ? body?.completed
        : nextStatus === "completed",
    updated_at: new Date().toISOString(),
    updated_by: userId,
  };

  const changes = diffFields(current, updates);
  const OVERRIDE_FIELDS = new Set([
    "due_date",
    "assignment_type",
    "class_name",
    "grading_weight",
    "assignment_name",
    "requirements",
  ]);

  const overrideChanges =
    current.syllabus_id !== null
      ? changes.filter((change) => OVERRIDE_FIELDS.has(change.field))
      : [];

  if (overrideChanges.length > 0) {
    const { error: overrideError } = await supabase.from("assignment_overrides").insert(
      overrideChanges.map((change) => ({
        assignment_id: params.id,
        user_id: userId,
        field_changed: change.field,
        old_value: change.oldValue,
        new_value: change.newValue,
        reason,
      }))
    );
    if (overrideError) {
      return NextResponse.json(
        { success: false, error: overrideError.message || "Failed to record override." },
        { status: 500 }
      );
    }
  }

  const { error: updateError } = await supabase
    .from("assignments")
    .update(updates)
    .eq("id", params.id)
    .eq("user_id", userId);

  if (updateError) {
    return NextResponse.json(
      { success: false, error: updateError.message },
      { status: 500 }
    );
  }

  let needsPlanPrompt = false;
  if (nextStatus === "completed") {
    await supabase
      .from("assignment_tasks")
      .update({
        status: "complete",
        completed_at: new Date().toISOString(),
      })
      .eq("assignment_id", params.id)
      .eq("user_id", userId)
      .neq("status", "complete");
  }

  if (nextStatus === "in_progress") {
    const { count } = await supabase
      .from("assignment_tasks")
      .select("id", { count: "exact", head: true })
      .eq("assignment_id", params.id)
      .eq("user_id", userId);
    needsPlanPrompt = (count || 0) === 0;
  }

  if (nextStatus !== undefined && current.status !== nextStatus) {
    try {
      await supabase.from("assignment_change_log").insert({
        assignment_id: params.id,
        user_id: userId,
        change_type: "status_update",
        old_data: { status: current.status, completed: current.completed },
        new_data: { status: nextStatus, completed: nextStatus === "completed" },
      });
    } catch {
      // Keep status updates non-blocking if audit schema differs by environment.
    }
  }

  return NextResponse.json(
    { success: true, needs_plan_prompt: needsPlanPrompt },
    { status: 200 }
  );
}
