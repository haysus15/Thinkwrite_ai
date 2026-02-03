// src/app/api/academic/paper/emergency-skip/[paperId]/route.ts
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: { paperId: string } }
) {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const currentMonth = new Date().toISOString().slice(0, 7);
  const supabase = await createSupabaseServerClient();

  const { data: paper, error: paperError } = await supabase
    .from("academic_papers")
    .select("id")
    .eq("id", params.paperId)
    .eq("user_id", userId)
    .single();

  if (paperError || !paper) {
    return NextResponse.json(
      { success: false, error: "Paper not found." },
      { status: 404 }
    );
  }

  const { data: existingSkips, error: skipError } = await supabase
    .from("emergency_skips")
    .select("id")
    .eq("user_id", userId)
    .eq("month", currentMonth);

  if (skipError) {
    return NextResponse.json(
      { success: false, error: skipError.message },
      { status: 500 }
    );
  }

  if ((existingSkips?.length || 0) > 0) {
    return NextResponse.json(
      { success: false, error: "Emergency skip already used this month." },
      { status: 400 }
    );
  }

  const { error: insertError } = await supabase
    .from("emergency_skips")
    .insert({
      user_id: userId,
      paper_id: params.paperId,
      month: currentMonth,
      skipped_at: new Date().toISOString(),
    });

  if (insertError) {
    return NextResponse.json(
      { success: false, error: insertError.message },
      { status: 500 }
    );
  }

  const { error: updateError } = await supabase
    .from("academic_papers")
    .update({
      emergency_skip_used: true,
      checkpoint_passed: false,
      completed_at: new Date().toISOString(),
    })
    .eq("id", params.paperId)
    .eq("user_id", userId);

  if (updateError) {
    return NextResponse.json(
      { success: false, error: updateError.message },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      success: true,
      skipped: true,
      message: "Emergency skip recorded.",
    },
    { status: 200 }
  );
}
