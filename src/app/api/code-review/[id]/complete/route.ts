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
    return NextResponse.json({ error: "review_id is required." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  const { data: review, error: reviewError } = await supabase
    .schema("coding_review")
    .from("sessions")
    .select("id, challenge_set_id, code_snapshot")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (reviewError || !review) {
    return NextResponse.json({ error: reviewError?.message || "Review not found." }, { status: 404 });
  }

  const hasContent = String(review.code_snapshot || "").trim().length > 0;
  if (!hasContent) {
    return NextResponse.json(
      { error: "Code must have content before marking complete." },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .schema("coding_review")
    .from("sessions")
    .update({
      is_complete: true,
      completed_at: now,
      updated_at: now,
      last_active_at: now,
    })
    .eq("id", id)
    .eq("user_id", userId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  let setComplete = false;
  const setId: string | null = review.challenge_set_id ? String(review.challenge_set_id) : null;

  if (setId) {
    const { data: setSessions, error: setSessionsError } = await supabase
      .schema("coding_review")
      .from("sessions")
      .select("id, is_complete")
      .eq("user_id", userId)
      .eq("challenge_set_id", setId);

    if (setSessionsError) {
      return NextResponse.json({ error: setSessionsError.message }, { status: 500 });
    }

    const allComplete =
      Array.isArray(setSessions) &&
      setSessions.length > 0 &&
      setSessions.every((row) => Boolean(row.is_complete));

    if (allComplete) {
      const { error: setUpdateError } = await supabase
        .from("code_challenge_sets")
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
