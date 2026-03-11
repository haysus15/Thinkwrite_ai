import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type AssignmentStatusFilter = "active" | "archived" | "completed" | "all";

type AssignmentStatus =
  | "inbox"
  | "planned"
  | "in_progress"
  | "ready_to_submit"
  | "submitted"
  | "completed";

type AssignmentTaskRow = { status?: "pending" | "in_progress" | "complete" };
type AssignmentRow = {
  status?: AssignmentStatus | null;
  completed?: boolean | null;
  due_date?: string | null;
  assignment_tasks?: AssignmentTaskRow[];
  [key: string]: unknown;
};

function calculateProgress(
  tasks: Array<{ status?: "pending" | "in_progress" | "complete" }>
): number {
  if (tasks.length === 0) return 0;
  const complete = tasks.filter((task) => task.status === "complete").length;
  return Math.round((complete / tasks.length) * 100);
}

function daysUntilDue(dueDate: string | null): number {
  if (!dueDate) return Number.POSITIVE_INFINITY;
  const due = new Date(`${dueDate}T00:00:00`);
  if (Number.isNaN(due.getTime())) return Number.POSITIVE_INFINITY;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function isAtRisk(input: {
  status: AssignmentStatus;
  daysUntilDue: number;
  incompleteTaskCount: number;
  taskCount: number;
}): boolean {
  if (input.daysUntilDue <= 3 && input.incompleteTaskCount > 1) return true;
  if (
    input.daysUntilDue <= 7 &&
    (input.status === "inbox" ||
      (input.status === "planned" && input.taskCount === 0))
  ) {
    return true;
  }
  return false;
}

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
      "id, syllabus_id, assignment_name, class_name, assignment_type, due_date, agenda_date, requirements, notes, completed, status, priority, grading_weight, archived_at, updated_at, assignment_tasks(id, task_type, label, status, planned_date, completed_at, sort_order)"
    )
    .eq("user_id", userId);

  if (className) {
    query = query.eq("class_name", className);
  }
  if (syllabusId) {
    query = query.eq("syllabus_id", syllabusId);
  }

  if (status === "active") {
    query = query
      .is("archived_at", null)
      .neq("status", "completed");
  } else if (status === "completed") {
    query = query
      .is("archived_at", null)
      .eq("status", "completed");
  } else if (status === "archived") {
    query = query.not("archived_at", "is", null);
  }

  const { data, error: fetchError } = await query
    .order("agenda_date", { ascending: true, nullsFirst: false })
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(400);

  if (fetchError) {
    return NextResponse.json(
      { success: false, error: fetchError.message },
      { status: 500 }
    );
  }

  const assignments = (data || []).map((row: AssignmentRow) => {
    const tasks = Array.isArray(row.assignment_tasks) ? row.assignment_tasks : [];
    const status: AssignmentStatus =
      row.status || (row.completed ? "completed" : "inbox");
    const progressPercent = calculateProgress(tasks);
    const dueInDays = daysUntilDue(row.due_date || null);
    const incompleteTaskCount = tasks.filter(
      (task: AssignmentTaskRow) => task.status !== "complete"
    ).length;

    return {
      ...row,
      status,
      tasks,
      progress_percent: progressPercent,
      days_until_due: dueInDays,
      is_at_risk: isAtRisk({
        status,
        daysUntilDue: dueInDays,
        incompleteTaskCount,
        taskCount: tasks.length,
      }),
    };
  });

  return NextResponse.json({ success: true, assignments }, { status: 200 });
}
