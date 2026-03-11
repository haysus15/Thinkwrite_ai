// src/app/api/travis/assignment/complete/[id]/route.ts
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function PUT(
  _request: Request,
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

  const supabase = await createSupabaseServerClient();
  const completedAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("assignments")
    .update({
      completed: true,
      status: "completed",
      updated_at: completedAt,
      updated_by: userId,
    })
    .eq("id", params.id)
    .eq("user_id", userId)
    .is("archived_at", null);

  if (updateError) {
    return NextResponse.json(
      { success: false, error: updateError.message },
      { status: 500 }
    );
  }

  await supabase
    .from("assignment_tasks")
    .update({
      status: "complete",
      completed_at: completedAt,
    })
    .eq("assignment_id", params.id)
    .eq("user_id", userId)
    .neq("status", "complete");

  try {
    await supabase.from("assignment_change_log").insert({
      assignment_id: params.id,
      user_id: userId,
      change_type: "status_update",
      old_data: null,
      new_data: { status: "completed", completed: true },
    });
  } catch {
    // Non-blocking best-effort audit write.
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
