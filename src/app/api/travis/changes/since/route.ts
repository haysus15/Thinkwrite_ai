import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function sinceIso(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

export async function GET(request: NextRequest) {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const hoursParam = Number(request.nextUrl.searchParams.get("hours") || "24");
  const hours = Number.isFinite(hoursParam) && hoursParam > 0 ? hoursParam : 24;
  const since = sinceIso(hours);

  const supabase = await createSupabaseServerClient();

  const [{ data: statusChanges }, { data: completedTasks }, { data: createdAssignments }] =
    await Promise.all([
      supabase
        .from("assignment_change_log")
        .select("id, assignment_id, changed_at, old_data, new_data, assignments(assignment_name)")
        .eq("user_id", userId)
        .gte("changed_at", since)
        .eq("change_type", "status_update")
        .order("changed_at", { ascending: false })
        .limit(30),
      supabase
        .from("assignment_tasks")
        .select("id, assignment_id, completed_at, label, task_type, assignments(assignment_name)")
        .eq("user_id", userId)
        .not("completed_at", "is", null)
        .gte("completed_at", since)
        .order("completed_at", { ascending: false })
        .limit(30),
      supabase
        .from("assignments")
        .select("id, assignment_name, created_at")
        .eq("user_id", userId)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

  return NextResponse.json(
    {
      success: true,
      since,
      status_changes: statusChanges || [],
      completed_tasks: completedTasks || [],
      new_assignments: createdAssignments || [],
    },
    { status: 200 }
  );
}
