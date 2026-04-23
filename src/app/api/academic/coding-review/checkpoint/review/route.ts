import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
// VOICE DISCONNECTED — Mirror Mode ships standalone. Reconnect via API contract.

export const runtime = "nodejs";

function getClaudeApiKey() {
  return process.env.CLAUDE_API_KEY || null;
}

function readFirstText(content: unknown): string {
  if (!Array.isArray(content) || content.length === 0) return "";
  const first = content[0];
  if (first && typeof first === "object" && "type" in first) {
    const block = first as { type?: string; text?: unknown };
    if (block.type === "text" && typeof block.text === "string") {
      return block.text;
    }
  }
  return "";
}

export async function POST(request: Request) {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const apiKey = getClaudeApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: "Claude API key missing." },
      { status: 500 }
    );
  }

  const body = await request.json();
  const language = typeof body?.language === "string" ? body.language : "";
  const code = typeof body?.code === "string" ? body.code : "";
  const output = typeof body?.output === "string" ? body.output : "";
  const explain = typeof body?.explain === "string" ? body.explain : "";
  const modify = typeof body?.modify === "string" ? body.modify : "";
  const sessionId = typeof body?.session_id === "string" ? body.session_id : "";
  const challengeId =
    typeof body?.challenge_id === "string" ? body.challenge_id : null;
  const pathId = typeof body?.path_id === "string" ? body.path_id : null;
  const lessonIndex =
    typeof body?.lesson_index === "number" ? body.lesson_index : null;

  if (!language || !code || !explain || !modify || !sessionId) {
    return NextResponse.json(
      { success: false, error: "Missing checkpoint inputs." },
      { status: 400 }
    );
  }

  const anthropic = new Anthropic({ apiKey });
  const system = `You are Victor in Coding Review. You must decide if the student understands their code.
Rules:
- NEVER write code for the student.
- Evaluate their explanation and modification request.
- Return strict JSON only: {"pass": boolean, "feedback": string}
- Be direct and concise.`;

  const userContent = `Language: ${language}

Code:
${code}

Output:
${output || "(none)"}

Student explanation:
${explain}

Student modification response:
${modify}

Return JSON only.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 300,
    system,
    messages: [{ role: "user", content: userContent }],
  });

  const text = readFirstText(response.content);
  let parsed: { pass: boolean; feedback: string } | null = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid response format." },
      { status: 500 }
    );
  }

  const pass = Boolean(parsed.pass);
  const feedback = parsed.feedback || "";

  const supabase = await createSupabaseServerClient();
  const { data: submission, error: submissionError } = await supabase
    .schema("coding_review")
    .from("submissions")
    .insert({
      user_id: userId,
      session_id: sessionId,
      language,
      code,
      output,
      error: null,
      execution_time_ms: null,
      challenge_id: challengeId,
      is_checkpoint_attempt: true,
      checkpoint_passed: pass,
    })
    .select("id")
    .single();

  if (submissionError || !submission) {
    return NextResponse.json(
      { success: false, error: submissionError?.message || "Submission failed." },
      { status: 500 }
    );
  }

  const { data: review, error: reviewError } = await supabase
    .schema("coding_review")
    .from("checkpoint_reviews")
    .insert({
      user_id: userId,
      session_id: sessionId,
      submission_id: submission.id,
      path_id: pathId,
      lesson_index: lessonIndex,
      pass,
      feedback,
    })
    .select("id")
    .single();

  if (reviewError || !review) {
    return NextResponse.json(
      { success: false, error: reviewError?.message || "Review failed." },
      { status: 500 }
    );
  }


  return NextResponse.json(
    {
      success: true,
      pass,
      feedback,
      submission_id: submission.id,
      review_id: review.id,
    },
    { status: 200 }
  );
}
