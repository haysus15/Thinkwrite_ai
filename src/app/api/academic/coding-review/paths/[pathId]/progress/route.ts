import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ pathId: string }> }
) {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const { pathId } = await context.params;
  const body = await request.json();

  const updates: Record<string, unknown> = {
    last_active_at: new Date().toISOString(),
  };

  if (typeof body?.current_lesson === "number") {
    updates.current_lesson = body.current_lesson;
  }
  if (Array.isArray(body?.lessons_completed)) {
    updates.lessons_completed = body.lessons_completed;
  }
  if (typeof body?.placement_level === "number") {
    updates.placement_level = body.placement_level;
  }
  if (Array.isArray(body?.struggle_topics)) {
    updates.struggle_topics = body.struggle_topics;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error: updateError } = await supabase
    .schema("coding_review")
    .from("path_progress")
    .update(updates)
    .eq("user_id", userId)
    .eq("path_id", pathId)
    .select("*")
    .single();

  if (updateError || !data) {
    return NextResponse.json(
      { success: false, error: updateError?.message || "Update failed." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, progress: data }, { status: 200 });
}
