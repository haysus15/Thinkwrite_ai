import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { runOpenAiJson, runTravisClaude } from "@/lib/academic/travisAi";

type RebalanceTask = { id: string; planned_date: string | null };

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
      "id, assignment_name, class_name, due_date, status, priority, assignment_tasks(id, status, planned_date)"
    )
    .eq("user_id", userId)
    .is("archived_at", null)
    .not("status", "in", "(completed,submitted)");

  const result = await runOpenAiJson<{
    updated_tasks: RebalanceTask[];
    risk_level_per_assignment: Array<{ id: string; risk: "low" | "medium" | "high" }>;
  }>({
    system:
      "You are a workload rebalancer. Return JSON only: updated_tasks[{id,planned_date}], risk_level_per_assignment[{id,risk}].",
    user: JSON.stringify({
      assignments: assignments || [],
      context: "student is behind and needs a realistic rebalance",
    }),
    fallback: { updated_tasks: [], risk_level_per_assignment: [] },
  });

  if (confirm) {
    await Promise.all(
      (result.updated_tasks || []).map((task) =>
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
    toolName: "rebalance_workload",
    structuredData: result,
    extraInstruction: confirm
      ? "Confirm which tasks moved and what remains risky."
      : "Propose this rebalance and ask for confirmation before applying changes.",
  });

  return NextResponse.json(
    { success: true, proposed: !confirm, result, message },
    { status: 200 }
  );
}

