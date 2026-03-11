// src/app/api/travis/assignments/upcoming/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { todayDateString } from "@/lib/academic/dueDate";

export async function GET(request: NextRequest) {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const today = todayDateString();
  const className = request.nextUrl.searchParams.get("class_name");

  let query = supabase
    .from("assignments")
    .select("id, assignment_name, class_name, due_date, assignment_type")
    .eq("user_id", userId)
    .eq("completed", false)
    .is("archived_at", null)
    .gte("due_date", today)
    .order("due_date", { ascending: true })
    .limit(6);

  if (className) {
    query = query.eq("class_name", className);
  }

  const { data, error: fetchError } = await query;

  if (fetchError) {
    return NextResponse.json(
      { success: false, error: fetchError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, assignments: data }, { status: 200 });
}
