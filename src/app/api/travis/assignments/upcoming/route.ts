// src/app/api/travis/assignments/upcoming/route.ts
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
  const now = new Date().toISOString();
  const { data, error: fetchError } = await supabase
    .from("assignments")
    .select("id, assignment_name, class_name, due_date, assignment_type")
    .eq("user_id", userId)
    .eq("completed", false)
    .gte("due_date", now)
    .order("due_date", { ascending: true })
    .limit(6);

  if (fetchError) {
    return NextResponse.json(
      { success: false, error: fetchError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, assignments: data }, { status: 200 });
}
