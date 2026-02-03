// src/app/api/quiz/[id]/route.ts
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
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
    .from("quizzes")
    .select("id, title, questions, difficulty")
    .eq("id", params.id)
    .eq("user_id", userId)
    .single();

  if (fetchError || !data) {
    return NextResponse.json(
      { success: false, error: "Quiz not found." },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, quiz: data }, { status: 200 });
}
