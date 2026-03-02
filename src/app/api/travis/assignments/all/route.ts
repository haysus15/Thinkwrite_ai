import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type AssignmentStatusFilter = "active" | "archived" | "completed" | "all";

export async function GET(request: NextRequest) {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const search = request.nextUrl.searchParams;
  const className = search.get("class_name");
  const syllabusId = search.get("syllabus_id");
  const status = (search.get("status") || "active") as AssignmentStatusFilter;

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("assignments")
    .select(
      "id, syllabus_id, assignment_name, class_name, assignment_type, due_date, requirements, notes, completed, archived_at, updated_at"
    )
    .eq("user_id", userId);

  if (className) {
    query = query.eq("class_name", className);
  }
  if (syllabusId) {
    query = query.eq("syllabus_id", syllabusId);
  }

  if (status === "active") {
    query = query.is("archived_at", null).eq("completed", false);
  } else if (status === "completed") {
    query = query.is("archived_at", null).eq("completed", true);
  } else if (status === "archived") {
    query = query.not("archived_at", "is", null);
  }

  const { data, error: fetchError } = await query
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(400);

  if (fetchError) {
    return NextResponse.json(
      { success: false, error: fetchError.message },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { success: true, assignments: data || [] },
    { status: 200 }
  );
}
