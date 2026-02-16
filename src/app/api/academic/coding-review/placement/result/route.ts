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

  const pathId = request.nextUrl.searchParams.get("path_id") || "";
  if (!pathId) {
    return NextResponse.json(
      { success: false, error: "path_id is required." },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error: fetchError } = await supabase
    .schema("coding_review")
    .from("placements")
    .select("*")
    .eq("user_id", userId)
    .eq("path_id", pathId)
    .single();

  if (fetchError || !data) {
    return NextResponse.json(
      { success: false, error: fetchError?.message || "Placement not found." },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, placement: data }, { status: 200 });
}
