import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const supabase = await createSupabaseServerClient();

  const { data, error: fetchError } = await supabase
    .from("syllabi")
    .select("id, class_name, status, uploaded_at, reviewed_at, confirmed")
    .eq("user_id", userId)
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json(
      { success: false, error: fetchError.message },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { success: true, syllabus: data || null },
    { status: 200 }
  );
}
