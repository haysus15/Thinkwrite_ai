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

  const language = request.nextUrl.searchParams.get("language");
  const supabase = await createSupabaseServerClient();

  const pathsQuery = supabase
    .schema("coding_review")
    .from("paths")
    .select("*")
    .order("title", { ascending: true });

  if (language) {
    pathsQuery.eq("language", language);
  }

  const { data: paths, error: pathsError } = await pathsQuery;
  if (pathsError) {
    return NextResponse.json(
      {
        success: false,
        error: pathsError.message || "Fetch failed.",
        code: pathsError.code || null,
      },
      { status: 500 }
    );
  }

  const { data: progress, error: progressError } = await supabase
    .schema("coding_review")
    .from("path_progress")
    .select("*")
    .eq("user_id", userId);

  if (progressError) {
    return NextResponse.json(
      { success: false, error: progressError.message || "Fetch failed." },
      { status: 500 }
    );
  }

  const progressByPath = new Map(
    (progress || []).map((row) => [row.path_id, row])
  );

  const result = (paths || []).map((path) => ({
    ...path,
    progress: progressByPath.get(path.id) || null,
  }));

  return NextResponse.json({ success: true, paths: result }, { status: 200 });
}
