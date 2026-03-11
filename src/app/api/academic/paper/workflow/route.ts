import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const WORKFLOW_STEPS = ["outline", "generate", "checkpoint", "library"] as const;
type WorkflowStep = (typeof WORKFLOW_STEPS)[number];

function isWorkflowStep(value: unknown): value is WorkflowStep {
  return typeof value === "string" && WORKFLOW_STEPS.includes(value as WorkflowStep);
}

export async function GET(request: NextRequest) {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
  }

  const assignmentId = request.nextUrl.searchParams.get("assignmentId");
  if (!assignmentId) {
    return NextResponse.json({ success: false, error: "assignmentId is required" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error: fetchError } = await supabase
    .from("academic_papers")
    .select(
      "id, assignment_id, outline_id, workflow_step, workflow_step_updated_at, paper_content, checkpoint_passed, emergency_skip_used, created_at"
    )
    .eq("user_id", userId)
    .eq("assignment_id", assignmentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ success: false, error: fetchError.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ success: true, paper: null }, { status: 200 });
  }

  return NextResponse.json(
    {
      success: true,
      paper: {
        id: data.id,
        assignment_id: data.assignment_id,
        outline_id: data.outline_id,
        workflow_step: data.workflow_step || "outline",
        workflow_step_updated_at: data.workflow_step_updated_at,
        has_paper_content: Boolean(String(data.paper_content || "").trim()),
        checkpoint_passed: Boolean(data.checkpoint_passed),
        emergency_skip_used: Boolean(data.emergency_skip_used),
        created_at: data.created_at,
      },
    },
    { status: 200 }
  );
}

export async function PATCH(request: NextRequest) {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
  }

  const body = await request.json();
  const paperId = typeof body?.paperId === "string" ? body.paperId : "";
  const workflowStep = body?.workflowStep;

  if (!paperId || !isWorkflowStep(workflowStep)) {
    return NextResponse.json(
      { success: false, error: "paperId and workflowStep are required." },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error: updateError } = await supabase
    .from("academic_papers")
    .update({
      workflow_step: workflowStep,
      workflow_step_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", paperId)
    .eq("user_id", userId)
    .select("id, workflow_step, workflow_step_updated_at")
    .single();

  if (updateError || !data) {
    return NextResponse.json(
      { success: false, error: updateError?.message || "Unable to persist workflow step." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, paper: data }, { status: 200 });
}
