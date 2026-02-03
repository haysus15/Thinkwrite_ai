import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { mathStore } from "@/lib/math-mode/store";

function getClaudeApiKey() {
  return process.env.CLAUDE_API_KEY || null;
}

export async function POST(request: Request) {
  const { userId } = await getAuthUser();
  if (!userId) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  const apiKey = getClaudeApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Claude API key missing" },
      { status: 500 }
    );
  }

  const body = await request.json();
  const problem = body?.problem;
  const steps = Array.isArray(body?.steps) ? body.steps : [];

  const anthropic = new Anthropic({ apiKey });
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 200,
    system: `You are Victor. Provide one Socratic question or hint to move the student forward. Do not solve the problem. Keep it short.`,
    messages: [
      {
        role: "user",
        content: `Problem: ${problem?.latex || ""}
Steps so far: ${steps.map((step: { latex: string }) => step.latex).join("; ")}`,
      },
    ],
  });

  const message = response.content?.[0]?.text || "State your next step and justify it.";
  const guidance = mathStore.addGuidance({
    problem_id: problem?.id || "unknown",
    message,
    guidance_type: "question",
  });

  return NextResponse.json({ guidance });
}
