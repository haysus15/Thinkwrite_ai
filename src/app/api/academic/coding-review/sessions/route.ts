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

  const searchParams = request.nextUrl.searchParams;
  const limit = Math.min(
    Math.max(Number(searchParams.get("limit") || 20), 1),
    100
  );
  const offset = Math.max(Number(searchParams.get("offset") || 0), 0);

  const supabase = await createSupabaseServerClient();
  const { data, error: fetchError } = await supabase
    .schema("coding_review")
    .from("sessions")
    .select("*")
    .eq("user_id", userId)
    .order("last_active_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (fetchError) {
    return NextResponse.json(
      { success: false, error: fetchError.message || "Fetch failed." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, sessions: data || [] }, { status: 200 });
}
