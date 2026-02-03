// src/app/api/quiz/attempt/[attemptId]/route.ts
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: { attemptId: string } }
) {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error: fetchError } = await supabase
    .from("quiz_attempts")
    .select("id, quiz_id, results, score, correct_count, total_questions")
    .eq("id", params.attemptId)
    .eq("user_id", userId)
    .single();

  if (fetchError || !data) {
    return NextResponse.json(
      { success: false, error: "Attempt not found." },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, attempt: data }, { status: 200 });
}
