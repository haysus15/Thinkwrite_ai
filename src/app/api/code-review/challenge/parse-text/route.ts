import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { parseCodeChallenges } from "@/lib/code-review/challengeParser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function getClaudeApiKey() {
  return process.env.CLAUDE_API_KEY || null;
}

export async function POST(request: Request) {
  const { userId } = await getAuthUser();
  if (!userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const text = typeof body?.text === "string" ? body.text : "";
    const challengeSetId = typeof body?.challenge_set_id === "string" ? body.challenge_set_id : "";

    if (!text.trim() || !challengeSetId) {
      return NextResponse.json(
        { error: "text and challenge_set_id are required." },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();
    const { data: setRow, error: setError } = await supabase
      .from("code_challenge_sets")
      .select("id")
      .eq("id", challengeSetId)
      .eq("user_id", userId)
      .maybeSingle();
    if (setError || !setRow) {
      return NextResponse.json({ error: "Challenge set not found." }, { status: 404 });
    }

    const challenges = await parseCodeChallenges({ text, apiKey: getClaudeApiKey() });
    return NextResponse.json({ challenges });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to parse challenge text.",
      },
      { status: 500 }
    );
  }
}
