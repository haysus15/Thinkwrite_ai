import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { runOpenAiJson, runTravisClaude } from "@/lib/academic/travisAi";

type TaskMove = { id: string; planned_date: string | null };

export async function POST(request: NextRequest) {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const confirm = Boolean(body?.confirm);
  const studentName =
    typeof body?.studentName === "string" ? body.studentName : null;

  const supabase = await createSupabaseServerClient();
  const { data: assignments } = await supabase
    .from("assignments")
    .select(
      "id, assignment_name, class_name, due_date, status, priority, grading_weight, assignment_tasks(id, status, planned_date)"
    )
    .eq("user_id", userId)
    .is("archived_at", null)
    .neq("status", "completed");

  const plan = await runOpenAiJson<{
    assignments: Array<{ id: string; tasks: TaskMove[] }>;
    conflicts: string[];
    risk_flags: string[];
  }>({
    system:
      "You are a weekly scheduler. Return JSON: assignments[{id,tasks:[{id,planned_date}]}], conflicts[], risk_flags[].",
    user: JSON.stringify({
      assignments: assignments || [],
      objective: "build balanced weekly schedule",
    }),
    fallback: { assignments: [], conflicts: [], risk_flags: [] },
  });

  if (confirm) {
    const updates = plan.assignments.flatMap((item) => item.tasks || []);
    await Promise.all(
      updates.map((task) =>
        supabase
          .from("assignment_tasks")
          .update({ planned_date: task.planned_date })
          .eq("id", task.id)
          .eq("user_id", userId)
      )
    );
  }

  const message = await runTravisClaude({
    studentName,
    toolName: "build_weekly_schedule",
    structuredData: plan,
    extraInstruction: confirm
      ? "Confirm that schedule updates have been applied."
      : "Present this as a proposed weekly schedule and request confirmation.",
  });

  return NextResponse.json(
    { success: true, proposed: !confirm, schedule: plan, message },
    { status: 200 }
  );
}

