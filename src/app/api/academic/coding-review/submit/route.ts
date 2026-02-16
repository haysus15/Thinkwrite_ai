import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ALLOWED_LANGUAGES = new Set(["python", "sql", "javascript"]);

export async function POST(request: Request) {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const body = await request.json();
  const language = typeof body?.language === "string" ? body.language : "";
  const sessionId = typeof body?.session_id === "string" ? body.session_id : "";
  const code = typeof body?.code === "string" ? body.code : "";
  const challengeId = typeof body?.challenge_id === "string" ? body.challenge_id : null;
  const output = typeof body?.output === "string" ? body.output : null;
  const errorText = typeof body?.error === "string" ? body.error : null;
  const executionTimeMs =
    typeof body?.execution_time_ms === "number" ? body.execution_time_ms : null;
  const checkpointPassed =
    typeof body?.checkpoint_passed === "boolean" ? body.checkpoint_passed : null;

  if (!ALLOWED_LANGUAGES.has(language)) {
    return NextResponse.json(
      { success: false, error: "Invalid language." },
      { status: 400 }
    );
  }
  if (!sessionId || !code) {
    return NextResponse.json(
      { success: false, error: "session_id and code are required." },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: submission, error: insertError } = await supabase
    .schema("coding_review")
    .from("submissions")
    .insert({
      user_id: userId,
      session_id: sessionId,
      language,
      code,
      output,
      error: errorText,
      execution_time_ms: executionTimeMs,
      challenge_id: challengeId,
      is_checkpoint_attempt: true,
      checkpoint_passed: checkpointPassed,
    })
    .select("id")
    .single();

  if (insertError) {
    return NextResponse.json(
      { success: false, error: insertError.message || "Submit failed." },
      { status: 500 }
    );
  }

  await supabase
    .schema("coding_review")
    .from("sessions")
    .update({
      code_snapshot: code,
      last_active_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("user_id", userId);

  return NextResponse.json(
    { success: true, submission_id: submission?.id || null },
    { status: 200 }
  );
}
