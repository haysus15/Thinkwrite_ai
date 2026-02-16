import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const pathId = request.nextUrl.searchParams.get("path_id");
  const lessonIndexParam = request.nextUrl.searchParams.get("lesson_index");
  const lessonIndex = lessonIndexParam ? Number(lessonIndexParam) : null;

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .schema("coding_review")
    .from("checkpoint_reviews")
    .select("id, submission_id, path_id, lesson_index, pass, feedback, reviewed_at")
    .eq("user_id", userId)
    .order("reviewed_at", { ascending: false });

  if (pathId) {
    query = query.eq("path_id", pathId);
  }
  if (lessonIndex !== null && !Number.isNaN(lessonIndex)) {
    query = query.eq("lesson_index", lessonIndex);
  }

  const { data, error: fetchError } = await query;
  if (fetchError) {
    return NextResponse.json(
      { success: false, error: fetchError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, reviews: data || [] }, { status: 200 });
}
