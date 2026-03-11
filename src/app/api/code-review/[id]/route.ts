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
    .schema("coding_review")
    .from("sessions")
    .select(
      "id, user_id, language, entry_type, challenge_set_id, set_order, assignment_id, code_snapshot, output_snapshot, victor_context, is_complete, created_at, updated_at, last_active_at, completed_at"
    )
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Review not found." }, { status: 404 });
  }

  let setContext = null;
  if (data.challenge_set_id) {
    const { data: setData } = await supabase
      .from("code_challenge_sets")
      .select("id, title, class_name, assignment_prompt, language, status")
      .eq("id", data.challenge_set_id)
      .eq("user_id", userId)
      .maybeSingle();
    setContext = setData || null;
  }

  return NextResponse.json({ review: data, set: setContext });
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
    last_active_at: new Date().toISOString(),
  };

  if (typeof body?.is_complete === "boolean") {
    updates.is_complete = body.is_complete;
    updates.completed_at = body.is_complete ? new Date().toISOString() : null;
  }
  if (typeof body?.code_snapshot === "string") {
    updates.code_snapshot = body.code_snapshot;
  }
  if (typeof body?.output_snapshot === "string") {
    updates.output_snapshot = body.output_snapshot;
  }
  if (body?.victor_context !== undefined) {
    updates.victor_context = body.victor_context;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .schema("coding_review")
    .from("sessions")
    .update(updates)
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "Unable to update review." },
      { status: 500 }
    );
  }

  if (typeof body?.is_complete === "boolean" && body.is_complete === false && data.challenge_set_id) {
    await supabase
      .from("code_challenge_sets")
      .update({
        status: "in_progress",
        completed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.challenge_set_id)
      .eq("user_id", userId);
  }

  return NextResponse.json({ review: data });
}
