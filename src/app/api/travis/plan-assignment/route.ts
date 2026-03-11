import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { runOpenAiJson, runTravisClaude } from "@/lib/academic/travisAi";

type PlannedTask = {
  task_type: "research" | "outline" | "draft" | "revise" | "submit" | "other";
  label: string;
  planned_date: string | null;
  sort_order: number;
};

function daysUntilDue(dueDate: string | null): number {
  if (!dueDate) return 0;
  const due = new Date(`${dueDate}T00:00:00`);
  if (Number.isNaN(due.getTime())) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export async function POST(request: NextRequest) {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const assignmentId = String(body?.assignmentId || body?.assignment_id || "").trim();
  const confirm = Boolean(body?.confirm);
  const studentName =
    typeof body?.studentName === "string" ? body.studentName : null;

  if (!assignmentId) {
    return NextResponse.json(
      { success: false, error: "assignmentId is required." },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: assignment, error: fetchError } = await supabase
    .from("assignments")
    .select("id, assignment_name, assignment_type, due_date, grading_weight, status")
    .eq("id", assignmentId)
    .eq("user_id", userId)
    .is("archived_at", null)
    .single();

  if (fetchError || !assignment) {
    return NextResponse.json(
      { success: false, error: "Assignment not found." },
      { status: 404 }
    );
  }

  const plan = await runOpenAiJson<{ tasks: PlannedTask[] }>({
    system:
      "You are a scheduling engine. Return JSON only with key 'tasks'. Each task includes task_type, label, planned_date (YYYY-MM-DD or null), sort_order.",
    user: JSON.stringify({
      assignment_id: assignment.id,
      assignment_type: assignment.assignment_type,
      due_date: assignment.due_date,
      grading_weight: assignment.grading_weight,
      status: assignment.status,
      days_available_until_due: daysUntilDue(assignment.due_date),
    }),
    fallback: {
      tasks: [
        { task_type: "research", label: "Review assignment requirements", planned_date: assignment.due_date, sort_order: 0 },
        { task_type: "draft", label: "Draft first complete version", planned_date: assignment.due_date, sort_order: 1 },
        { task_type: "revise", label: "Revise and finalize", planned_date: assignment.due_date, sort_order: 2 },
        { task_type: "submit", label: "Submit assignment", planned_date: assignment.due_date, sort_order: 3 },
      ],
    },
  });

  if (confirm) {
    const inserts = (plan.tasks || []).map((task, index) => ({
      assignment_id: assignment.id,
      user_id: userId,
      task_type: task.task_type,
      label: task.label || null,
      planned_date: task.planned_date || null,
      sort_order: typeof task.sort_order === "number" ? task.sort_order : index,
      status: "pending",
    }));

    if (inserts.length > 0) {
      await supabase.from("assignment_tasks").insert(inserts);
    }
    await supabase
      .from("assignments")
      .update({ status: "planned", completed: false, updated_by: userId })
      .eq("id", assignment.id)
      .eq("user_id", userId);
  }

  const message = await runTravisClaude({
    studentName,
    toolName: "generate_assignment_plan",
    structuredData: {
      assignment: assignment.assignment_name,
      confirm_required: !confirm,
      tasks: plan.tasks || [],
    },
    extraInstruction: confirm
      ? "Confirm that the plan has been saved."
      : "Present this as a proposed plan and ask for confirmation before writing.",
  });

  return NextResponse.json(
    { success: true, proposed: !confirm, tasks: plan.tasks || [], message },
    { status: 200 }
  );
}

