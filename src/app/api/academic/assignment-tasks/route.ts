import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type TaskType = "research" | "outline" | "draft" | "revise" | "submit" | "other";
type TaskStatus = "pending" | "in_progress" | "complete";

async function syncAssignmentStatus(supabase: any, assignmentId: string, userId: string) {
  const { data: tasks } = await supabase
    .from("assignment_tasks")
    .select("status")
    .eq("assignment_id", assignmentId)
    .eq("user_id", userId);

  if (!Array.isArray(tasks) || tasks.length === 0) return;

  const allComplete = tasks.every((task: { status?: string }) => task.status === "complete");
  if (allComplete) {
    await supabase
      .from("assignments")
      .update({ status: "ready_to_submit", updated_at: new Date().toISOString() })
      .eq("id", assignmentId)
      .eq("user_id", userId);
  }
}

async function seedAssignmentTasks(supabase: any, assignmentId: string, userId: string) {
  const { data: existing } = await supabase
    .from("assignment_tasks")
    .select("id")
    .eq("assignment_id", assignmentId)
    .eq("user_id", userId)
    .limit(1);

  if (Array.isArray(existing) && existing.length > 0) {
    return;
  }

  const tasks = [
    { task_type: "research", label: "Research", sort_order: 0 },
    { task_type: "outline", label: "Outline", sort_order: 1 },
    { task_type: "draft", label: "Draft", sort_order: 2 },
    { task_type: "revise", label: "Revise", sort_order: 3 },
    { task_type: "submit", label: "Submit", sort_order: 4 },
  ];

  await supabase.from("assignment_tasks").insert(
    tasks.map((task) => ({
      ...task,
      assignment_id: assignmentId,
      user_id: userId,
      status: "pending",
    }))
  );
}

async function updateTaskStatus(
  supabase: any,
  assignmentId: string,
  userId: string,
  taskType: TaskType,
  status: TaskStatus
) {
  await supabase
    .from("assignment_tasks")
    .update({
      status,
      completed_at: status === "complete" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("assignment_id", assignmentId)
    .eq("user_id", userId)
    .eq("task_type", taskType);

  await syncAssignmentStatus(supabase, assignmentId, userId);
}

export async function POST(request: NextRequest) {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const body = await request.json();
  const action = typeof body?.action === "string" ? body.action : "";
  const assignmentId = typeof body?.assignmentId === "string" ? body.assignmentId : "";

  if (!assignmentId) {
    return NextResponse.json(
      { success: false, error: "assignmentId is required." },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();

  if (action === "seed") {
    await seedAssignmentTasks(supabase, assignmentId, userId);
    return NextResponse.json({ success: true }, { status: 200 });
  }

  if (action === "update") {
    const taskType = body?.taskType as TaskType;
    const status = body?.status as TaskStatus;
    if (!taskType || !status) {
      return NextResponse.json(
        { success: false, error: "taskType and status are required for update." },
        { status: 400 }
      );
    }
    await updateTaskStatus(supabase, assignmentId, userId, taskType, status);
    return NextResponse.json({ success: true }, { status: 200 });
  }

  return NextResponse.json(
    { success: false, error: "Unsupported action." },
    { status: 400 }
  );
}
