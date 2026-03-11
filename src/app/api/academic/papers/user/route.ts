// src/app/api/academic/papers/user/route.ts
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error: fetchError } = await supabase
    .from("academic_papers")
    .select(
      "id, assignment_id, assignment_set_id, set_order, outline_id, topic, paper_content, created_at, updated_at, completed_at, word_count, citation_style, checkpoint_passed, emergency_skip_used, workflow_step, is_complete"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (fetchError) {
    return NextResponse.json(
      { success: false, error: fetchError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, papers: data }, { status: 200 });
}
