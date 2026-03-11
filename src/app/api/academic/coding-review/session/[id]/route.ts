import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const { id: sessionId } = await context.params;
  const supabase = await createSupabaseServerClient();
  const { data, error: fetchError } = await supabase
    .schema("coding_review")
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .single();

  if (fetchError || !data) {
    return NextResponse.json(
      { success: false, error: fetchError?.message || "Not found." },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, session: data }, { status: 200 });
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const { id: sessionId } = await context.params;
  const body = await request.json();

  const updates: Record<string, unknown> = {
    last_active_at: new Date().toISOString(),
  };

  if (typeof body?.code_snapshot === "string") {
    updates.code_snapshot = body.code_snapshot;
  }
  if (typeof body?.output_snapshot === "string") {
    updates.output_snapshot = body.output_snapshot;
  }
  if (body?.victor_context !== undefined) {
    updates.victor_context = body.victor_context;
  }
  if (typeof body?.completed_at === "string") {
    updates.completed_at = body.completed_at;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error: updateError } = await supabase
    .schema("coding_review")
    .from("sessions")
    .update(updates)
    .eq("id", sessionId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (updateError || !data) {
    return NextResponse.json(
      { success: false, error: updateError?.message || "Update failed." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, session: data }, { status: 200 });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const { id: sessionId } = await context.params;
  const supabase = await createSupabaseServerClient();
  const { data, error: updateError } = await supabase
    .schema("coding_review")
    .from("sessions")
    .update({
      completed_at: new Date().toISOString(),
      last_active_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (updateError || !data) {
    return NextResponse.json(
      { success: false, error: updateError?.message || "End session failed." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
