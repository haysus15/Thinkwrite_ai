import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
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

  const { data: assignment, error: assignmentError } = await supabase
    .from("assignments")
    .select("id")
    .eq("id", params.id)
    .eq("user_id", userId)
    .single();

  if (assignmentError || !assignment) {
    return NextResponse.json(
      { success: false, error: "Assignment not found." },
      { status: 404 }
    );
  }

  const { data, error: historyError } = await supabase
    .from("assignment_change_log")
    .select("id, change_type, changed_fields, reason, old_data, new_data, changed_at")
    .eq("assignment_id", params.id)
    .eq("user_id", userId)
    .order("changed_at", { ascending: false })
    .limit(20);

  if (historyError) {
    return NextResponse.json(
      { success: false, error: historyError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, history: data || [] }, { status: 200 });
}
