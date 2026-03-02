import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeAssignmentType } from "@/lib/academic/assignmentType";

function normalizeDueDate(value: string | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ draftId: string }> }
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
  const nextStatus = body?.draft_status;
  const allowedStatuses = new Set([
    "parsed",
    "edited",
    "approved",
    "rejected",
  ]);

  if (nextStatus !== undefined && !allowedStatuses.has(nextStatus)) {
    return NextResponse.json(
      { success: false, error: "Invalid draft_status value." },
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = {
    class_name: body?.class_name,
    assignment_name: body?.assignment_name,
    assignment_type:
      body?.assignment_type === undefined
        ? undefined
        : normalizeAssignmentType(body?.assignment_type, body?.assignment_name),
    due_date: normalizeDueDate(body?.due_date),
    requirements: body?.requirements,
    grading_weight: body?.grading_weight,
    draft_status: nextStatus,
  };

  const hasChanges = Object.values(updates).some((value) => value !== undefined);
  if (!hasChanges) {
    return NextResponse.json(
      { success: false, error: "No changes were provided." },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: existing, error: existingError } = await supabase
    .from("syllabus_assignment_drafts")
    .select("id, draft_status")
    .eq("id", params.draftId)
    .eq("user_id", userId)
    .single();

  if (existingError || !existing) {
    return NextResponse.json(
      { success: false, error: "Draft not found." },
      { status: 404 }
    );
  }

  if (nextStatus === undefined && existing.draft_status !== "published") {
    updates.draft_status = "edited";
  }

  const { data, error: updateError } = await supabase
    .from("syllabus_assignment_drafts")
    .update(updates)
    .eq("id", params.draftId)
    .eq("user_id", userId)
    .select(
      "id, syllabus_id, class_name, assignment_name, assignment_type, due_date, requirements, grading_weight, draft_status, updated_at"
    )
    .single();

  if (updateError || !data) {
    return NextResponse.json(
      { success: false, error: updateError?.message || "Update failed." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, draft: data }, { status: 200 });
}
