import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json(
      { success: false, error: "Study material id is required." },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error: fetchError } = await supabase
    .from("study_materials")
    .select(
      "id, title, class_name, topic, source_type, material_kind, source_id, content, file_type, created_at, updated_at"
    )
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (fetchError || !data) {
    return NextResponse.json(
      { success: false, error: "Study material not found." },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, material: data }, { status: 200 });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json(
      { success: false, error: "Study material id is required." },
      { status: 400 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request payload." },
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.materialKind === "string") {
    updates.material_kind = body.materialKind;
  }
  if (typeof body.sourceMeta === "string") {
    updates.source_id = body.sourceMeta;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ success: true, updated: false }, { status: 200 });
  }

  updates.updated_at = new Date().toISOString();

  const supabase = await createSupabaseServerClient();
  const { data, error: updateError } = await supabase
    .from("study_materials")
    .update(updates)
    .eq("id", id)
    .eq("user_id", userId)
    .select("id, material_kind, source_id, updated_at")
    .single();

  if (updateError || !data) {
    return NextResponse.json(
      { success: false, error: updateError?.message || "Update failed." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, material: data }, { status: 200 });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json(
      { success: false, error: "Study material id is required." },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();

  await supabase.from("quizzes").delete().eq("study_material_id", id).eq("user_id", userId);

  const { error: deleteError } = await supabase
    .from("study_materials")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (deleteError) {
    return NextResponse.json(
      { success: false, error: deleteError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
