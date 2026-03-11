import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function getClaudeApiKey() {
  return process.env.CLAUDE_API_KEY || null;
}

function readFirstText(content: unknown): string {
  if (!Array.isArray(content) || content.length === 0) return "";
  return content
    .map((entry) => {
      if (!entry || typeof entry !== "object" || !("type" in entry)) return "";
      const block = entry as { type?: string; text?: unknown };
      return block.type === "text" && typeof block.text === "string" ? block.text : "";
    })
    .join("\n")
    .trim();
}

function extractChallengeType(victorContext: unknown): string {
  if (!victorContext || typeof victorContext !== "object") return "other";
  const row = victorContext as Record<string, unknown>;
  const type = String(row.challenge_type || "other").trim();
  return type || "other";
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
    if (!challengeSetId) {
      return NextResponse.json({ error: "challenge_set_id is required." }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const [{ data: setRow, error: setError }, { data: sessions, error: sessionsError }] =
      await Promise.all([
        supabase
          .from("code_challenge_sets")
          .select("id, title, class_name, created_at, completed_at")
          .eq("id", challengeSetId)
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .schema("coding_review")
          .from("sessions")
          .select(
            "id, language, code_snapshot, victor_context, is_complete, created_at, updated_at, completed_at, set_order"
          )
          .eq("user_id", userId)
          .eq("challenge_set_id", challengeSetId)
          .order("set_order", { ascending: true }),
      ]);

    if (setError || !setRow) {
      return NextResponse.json({ error: setError?.message || "Set not found." }, { status: 404 });
    }
    if (sessionsError || !Array.isArray(sessions)) {
      return NextResponse.json({ error: sessionsError?.message || "Unable to load sessions." }, { status: 500 });
    }

    const challengesTotal = sessions.length;
    const languages = Array.from(
      new Set(sessions.map((session) => String(session.language || "").trim()).filter(Boolean))
    );

    const revisedChallenges = sessions.filter((session) => {
      if (!session.completed_at || !session.updated_at) return false;
      const completedAt = new Date(String(session.completed_at)).getTime();
      const updatedAt = new Date(String(session.updated_at)).getTime();
      return Number.isFinite(completedAt) && Number.isFinite(updatedAt) && updatedAt > completedAt;
    }).length;

    const cleanCompletions = sessions.filter((session) => Boolean(session.is_complete)).length - revisedChallenges;

    const startTs = new Date(String(setRow.created_at)).getTime();
    const endTs = setRow.completed_at
      ? new Date(String(setRow.completed_at)).getTime()
      : Date.now();
    const timeToCompleteSeconds =
      Number.isFinite(startTs) && Number.isFinite(endTs) && endTs > startTs
        ? Math.round((endTs - startTs) / 1000)
        : 0;

    const challengeTypes = Array.from(
      new Set(sessions.map((session) => extractChallengeType(session.victor_context)))
    );

    let naturalSummary = "You completed the full coding challenge set.";
    const apiKey = getClaudeApiKey();
    if (apiKey) {
      try {
        const anthropic = new Anthropic({ apiKey });
        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 260,
          system: "Write specific, factual summaries. No generic praise.",
          messages: [
            {
              role: "user",
              content: `A student completed a coding assignment set with ${challengesTotal} challenges.
Assignment: ${setRow.title}
Class: ${setRow.class_name || "Not specified"}
Languages: ${languages.join(", ") || "Not specified"}
Challenge types: ${challengeTypes.join(", ") || "other"}
Revised challenges: ${Math.max(revisedChallenges, 0)}

Write two to three sentences summarizing their performance across the full assignment.
Reference the types of challenges and any notable patterns in their approach.
Do not use generic praise. Be specific and factual.`,
            },
          ],
        });

        const generated = readFirstText(response.content);
        if (generated) naturalSummary = generated;
      } catch {
        // keep fallback
      }
    }

    return NextResponse.json({
      challenges_total: challengesTotal,
      clean_completions: Math.max(cleanCompletions, 0),
      revised_challenges: Math.max(revisedChallenges, 0),
      languages,
      time_to_complete_seconds: timeToCompleteSeconds,
      challenge_types: challengeTypes,
      natural_summary: naturalSummary,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to build set summary.",
      },
      { status: 500 }
    );
  }
}
