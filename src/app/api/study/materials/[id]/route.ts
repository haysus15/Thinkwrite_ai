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
      "id, title, class_name, topic, source_type, content, file_type, created_at"
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

  // Best effort cleanup of related quizzes.
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
