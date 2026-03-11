import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { userId } = await getAuthUser();
  if (!userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "paper_id is required." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  const { data: paper, error: paperError } = await supabase
    .from("academic_papers")
    .select("id, assignment_set_id, paper_content")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (paperError || !paper) {
    return NextResponse.json({ error: paperError?.message || "Paper not found." }, { status: 404 });
  }

  const hasContent = String(paper.paper_content || "").trim().length > 0;
  if (!hasContent) {
    return NextResponse.json(
      { error: "Paper must have content before marking complete." },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("academic_papers")
    .update({
      is_complete: true,
      completed_at: now,
      updated_at: now,
    })
    .eq("id", id)
    .eq("user_id", userId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  let setComplete = false;
  let setId: string | null = paper.assignment_set_id ? String(paper.assignment_set_id) : null;

  if (setId) {
    const { data: setPapers, error: setPapersError } = await supabase
      .from("academic_papers")
      .select("id, is_complete")
      .eq("user_id", userId)
      .eq("assignment_set_id", setId);

    if (setPapersError) {
      return NextResponse.json({ error: setPapersError.message }, { status: 500 });
    }

    const allComplete = Array.isArray(setPapers) && setPapers.length > 0 && setPapers.every((row) => Boolean(row.is_complete));
    if (allComplete) {
      const { error: setUpdateError } = await supabase
        .from("paper_assignment_sets")
        .update({
          status: "completed",
          completed_at: now,
          updated_at: now,
        })
        .eq("id", setId)
        .eq("user_id", userId);
      if (setUpdateError) {
        return NextResponse.json({ error: setUpdateError.message }, { status: 500 });
      }
      setComplete = true;
    }
  }

  return NextResponse.json({ complete: true, set_complete: setComplete, set_id: setId });
}
