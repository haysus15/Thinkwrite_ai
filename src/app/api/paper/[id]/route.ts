import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { userId } = await getAuthUser();
  if (!userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("academic_papers")
    .select(
      "id, user_id, assignment_id, assignment_set_id, set_order, outline_id, topic, paper_content, word_count, citation_style, checkpoint_passed, emergency_skip_used, workflow_step, workflow_step_updated_at, is_complete, created_at, updated_at, completed_at"
    )
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Paper not found." }, { status: 404 });
  }

  let setContext = null;
  if (data.assignment_set_id) {
    const { data: setData } = await supabase
      .from("paper_assignment_sets")
      .select("id, title, class_name, assignment_prompt, rubric_text, status")
      .eq("id", data.assignment_set_id)
      .eq("user_id", userId)
      .maybeSingle();
    setContext = setData || null;
  }

  return NextResponse.json({ paper: data, set: setContext });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { userId } = await getAuthUser();
  if (!userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json();

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof body?.is_complete === "boolean") {
    updates.is_complete = body.is_complete;
    updates.completed_at = body.is_complete ? new Date().toISOString() : null;
  }
  if (typeof body?.paper_content === "string") {
    updates.paper_content = body.paper_content;
  }
  if (typeof body?.workflow_step === "string") {
    updates.workflow_step = body.workflow_step;
    updates.workflow_step_updated_at = new Date().toISOString();
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("academic_papers")
    .update(updates)
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Unable to update paper." }, { status: 500 });
  }

  if (typeof body?.is_complete === "boolean" && body.is_complete === false && data.assignment_set_id) {
    await supabase
      .from("paper_assignment_sets")
      .update({
        status: "in_progress",
        completed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.assignment_set_id)
      .eq("user_id", userId);
  }

  return NextResponse.json({ paper: data });
}
