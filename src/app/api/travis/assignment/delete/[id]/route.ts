// src/app/api/travis/assignment/delete/[id]/route.ts
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function DELETE(
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
  const { data: existing, error: fetchError } = await supabase
    .from("assignments")
    .select("id")
    .eq("id", params.id)
    .eq("user_id", userId)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json(
      { success: false, error: "Assignment not found." },
      { status: 404 }
    );
  }

  // Soft-delete to preserve relational history and avoid FK conflicts in change-log tables.
  const { error: archiveError } = await supabase
    .from("assignments")
    .update({
      archived_at: new Date().toISOString(),
      archived_reason: "user_removed_from_travis",
      updated_at: new Date().toISOString(),
      updated_by: userId,
    })
    .eq("id", params.id)
    .eq("user_id", userId)
    .is("archived_at", null);

  if (archiveError) {
    return NextResponse.json(
      { success: false, error: archiveError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
