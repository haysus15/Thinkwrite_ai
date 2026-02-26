import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const id = params?.id;
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
