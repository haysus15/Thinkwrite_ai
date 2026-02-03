// src/app/api/academic/paper/checkpoint/[paperId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function getClaudeApiKey() {
  return process.env.CLAUDE_API_KEY || null;
}

function parseClaudeJson(text: string) {
  const trimmed = text.trim();
  const stripped = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim()
    : trimmed;
  return JSON.parse(stripped);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { paperId: string } }
) {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const body = await request.json();
  const conversation = Array.isArray(body?.conversation)
    ? body.conversation
    : [];

  if (!conversation.length) {
    return NextResponse.json(
      { success: false, error: "Checkpoint conversation is required." },
      { status: 400 }
    );
  }

  const apiKey = getClaudeApiKey();
  if (!apiKey) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Missing API key. Add CLAUDE_API_KEY to .env.local and restart next dev.",
      },
      { status: 500 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: paper, error: paperError } = await supabase
    .from("academic_papers")
    .select("id, topic, paper_content")
    .eq("id", params.paperId)
    .eq("user_id", userId)
    .single();

  if (paperError || !paper) {
    return NextResponse.json(
      { success: false, error: "Paper not found." },
      { status: 404 }
    );
  }

  const anthropic = new Anthropic({ apiKey });
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    system: `You are Victor evaluating if this student genuinely understands their paper.
Return JSON: { "passed": true/false, "reasoning": "...", "areas_of_concern": [] }
The student must demonstrate clear understanding, not just repeat lines.`,
    messages: [
      {
        role: "user",
        content: `PAPER TOPIC: ${paper.topic}

PAPER CONTENT:
${paper.paper_content}

CONVERSATION:
${conversation
  .map((message: any) => `${message.role}: ${message.content}`)
  .join("\n")}

Did the student demonstrate genuine understanding?`,
      },
    ],
  });

  let evaluation;
  try {
    evaluation = parseClaudeJson(response.content?.[0]?.text || "");
  } catch (parseError) {
    return NextResponse.json(
      { success: false, error: "Failed to parse evaluation." },
      { status: 500 }
    );
  }

  const passed = Boolean(evaluation?.passed);

  const { error: updateError } = await supabase
    .from("academic_papers")
    .update({
      checkpoint_passed: passed,
      understanding_conversation: conversation,
      completed_at: passed ? new Date().toISOString() : null,
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
      passed,
      reasoning: evaluation?.reasoning || "",
      areas_of_concern: evaluation?.areas_of_concern || [],
      victor_message: passed
        ? "Good. You understand what you wrote."
        : "Not enough. We keep going.",
    },
    { status: 200 }
  );
}
