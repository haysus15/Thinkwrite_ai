import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ParsedCodeChallenge } from "@/lib/code-review/challengeParser";

type ConfirmChallenge = ParsedCodeChallenge;

function normalizeLanguage(value: unknown): "python" | "sql" | "javascript" {
  const raw = String(value || "").toLowerCase().trim();
  if (raw === "sql") return "sql";
  if (raw === "javascript" || raw === "js") return "javascript";
  return "python";
}

export async function POST(request: Request) {
  const { userId } = await getAuthUser();
  if (!userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const challengeSetId =
      typeof body?.challenge_set_id === "string" ? body.challenge_set_id : "";
    const challenges = Array.isArray(body?.challenges)
      ? (body.challenges as ConfirmChallenge[])
      : [];

    if (!challengeSetId || challenges.length === 0) {
      return NextResponse.json(
        { error: "challenge_set_id and challenges are required." },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();
    const { data: setRow, error: setError } = await supabase
      .from("code_challenge_sets")
      .select("id, language")
      .eq("id", challengeSetId)
      .eq("user_id", userId)
      .maybeSingle();
    if (setError || !setRow) {
      return NextResponse.json({ error: "Challenge set not found." }, { status: 404 });
    }

    const setLanguage = normalizeLanguage(setRow.language);
    const rows = challenges
      .map((challenge, index) => {
        const challengeText = String(challenge.raw_text || "").trim();
        if (!challengeText) return null;
        return {
          user_id: userId,
          language: normalizeLanguage(challenge.language_hint || setLanguage),
          entry_type: "assignment",
          challenge_set_id: challengeSetId,
          set_order:
            challenge.order == null || Number.isNaN(Number(challenge.order))
              ? index + 1
              : Number(challenge.order),
          code_snapshot: "",
          output_snapshot: null,
          victor_context: {
            challenge_description: challengeText,
            challenge_type: challenge.challenge_type,
            language_hint: challenge.language_hint,
          },
          is_complete: false,
          last_active_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "At least one valid challenge is required." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .schema("coding_review")
      .from("sessions")
      .insert(rows)
      .select("id");

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || "Unable to create coding sessions for challenge set." },
        { status: 500 }
      );
    }

    const { error: setUpdateError } = await supabase
      .from("code_challenge_sets")
      .update({
        challenge_count: rows.length,
        status: "in_progress",
        updated_at: new Date().toISOString(),
      })
      .eq("id", challengeSetId)
      .eq("user_id", userId);

    if (setUpdateError) {
      return NextResponse.json({ error: setUpdateError.message }, { status: 500 });
    }

    return NextResponse.json({
      created: data.length,
      review_ids: data.map((row) => String(row.id)),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to confirm challenges.",
      },
      { status: 500 }
    );
  }
}
