// src/app/api/academic/paper/can-skip/route.ts
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

  const currentMonth = new Date().toISOString().slice(0, 7);
  const supabase = await createSupabaseServerClient();
  const { data, error: fetchError } = await supabase
    .from("emergency_skips")
    .select("id")
    .eq("user_id", userId)
    .eq("month", currentMonth);

  if (fetchError) {
    return NextResponse.json(
      { success: false, error: fetchError.message },
      { status: 500 }
    );
  }

  const usedCount = data?.length || 0;
  return NextResponse.json(
    { success: true, eligible: usedCount === 0, usedCount },
    { status: 200 }
  );
}
