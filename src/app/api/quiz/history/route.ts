// src/app/api/quiz/history/route.ts
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
  const { data: quizzes, error: quizError } = await supabase
    .from("quizzes")
    .select("id, title, study_material_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (quizError) {
    return NextResponse.json(
      { success: false, error: quizError.message },
      { status: 500 }
    );
  }

  const { data: attempts, error: attemptError } = await supabase
    .from("quiz_attempts")
    .select("id, quiz_id, score, correct_count, total_questions, completed_at")
    .eq("user_id", userId)
    .order("completed_at", { ascending: false });

  if (attemptError) {
    return NextResponse.json(
      { success: false, error: attemptError.message },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { success: true, quizzes: quizzes || [], attempts: attempts || [] },
    { status: 200 }
  );
}
