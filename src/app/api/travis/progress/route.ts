import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { runOpenAiJson, runTravisClaude } from "@/lib/academic/travisAi";
import { calculateProgress } from "@/lib/academic/progress";

type ProgressAssignment = {
  id: string;
  class_name: string | null;
  status: string | null;
  assignment_tasks?: Array<{ status?: "pending" | "in_progress" | "complete" }>;
};

export async function POST(request: NextRequest) {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const studentName =
    typeof body?.studentName === "string" ? body.studentName : null;

  const supabase = await createSupabaseServerClient();
  const { data: assignments } = await supabase
    .from("assignments")
    .select("id, class_name, status, assignment_tasks(status)")
    .eq("user_id", userId)
    .is("archived_at", null);

  const normalized = (assignments || []).map((assignment: ProgressAssignment) => {
    const tasks = Array.isArray(assignment.assignment_tasks)
      ? assignment.assignment_tasks.filter(
          (task): task is { status: "pending" | "in_progress" | "complete" } =>
            task.status === "pending" ||
            task.status === "in_progress" ||
            task.status === "complete"
        )
      : [];
    return {
      id: assignment.id,
      class_name: assignment.class_name || "Uncategorized",
      status: assignment.status,
      percent_complete: calculateProgress(tasks),
      at_risk_seed: assignment.status === "inbox" ? 1 : 0,
    };
  });

  const report = await runOpenAiJson<{
    by_class: Array<{ class_name: string; percent_complete: number; at_risk_count: number }>;
    overall_percent: number;
  }>({
    system:
      "You are a progress summarizer. Return JSON only: by_class[{class_name,percent_complete,at_risk_count}], overall_percent.",
    user: JSON.stringify({ assignments: normalized }),
    fallback: { by_class: [], overall_percent: 0 },
  });

  const message = await runTravisClaude({
    studentName,
    toolName: "get_progress_report",
    structuredData: report,
    extraInstruction: "Give a concise progress report per class with plain-language risk.",
  });

  return NextResponse.json({ success: true, report, message }, { status: 200 });
}
