import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
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
  const supabase = await createSupabaseServerClient();

  const { data: path, error: pathError } = await supabase
    .schema("coding_review")
    .from("paths")
    .select("*")
    .eq("id", pathId)
    .single();

  if (pathError || !path) {
    return NextResponse.json(
      { success: false, error: pathError?.message || "Path not found." },
      { status: 404 }
    );
  }

  const { data: lessons, error: lessonsError } = await supabase
    .schema("coding_review")
    .from("lessons")
    .select("*")
    .eq("path_id", pathId)
    .order("lesson_index", { ascending: true });

  if (lessonsError) {
    return NextResponse.json(
      { success: false, error: lessonsError.message || "Fetch failed." },
      { status: 500 }
    );
  }

  const { data: progress, error: progressError } = await supabase
    .schema("coding_review")
    .from("path_progress")
    .select("*")
    .eq("user_id", userId)
    .eq("path_id", pathId)
    .single();

  if (progressError && progressError.code !== "PGRST116") {
    return NextResponse.json(
      { success: false, error: progressError.message || "Fetch failed." },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { success: true, path, lessons: lessons || [], progress: progress || null },
    { status: 200 }
  );
}
