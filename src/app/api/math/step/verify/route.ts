import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { MathGuidance, MathVerificationResult } from "@/types/math-mode";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { mathStore } from "@/lib/math-mode/store";

function getClaudeApiKey() {
  return process.env.CLAUDE_API_KEY || null;
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
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
  const step = body?.step;
  if (!problem || !step) {
    return NextResponse.json({ error: "Problem and step required" }, { status: 400 });
  }

  const anthropic = new Anthropic({ apiKey });
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 500,
    system: `You are Victor verifying a student's math step.
Return strict JSON:
{
  "status": "correct|error|partial",
  "error_type": "arithmetic|conceptual|procedural|notation|",
  "feedback": "short feedback",
  "guidance": "Socratic follow-up question"
}
Do not solve the problem. Be concise.`,
    messages: [
      {
        role: "user",
        content: `Problem: ${problem.latex}
Step: ${step.latex}
Reasoning: ${step.reasoning || ""}`,
      },
    ],
  });

  const text = response.content?.[0]?.text || "{}";
  const parsed = safeJsonParse(text) || {};

  const result: MathVerificationResult = {
    step_id: step.id,
    is_correct: parsed.status === "correct",
    status: parsed.status || "unchecked",
    error_type: parsed.error_type || undefined,
    feedback: parsed.feedback || "Victor needs more detail on this step.",
    victor_guidance: parsed.guidance || undefined,
  };

  mathStore.updateStep(step.id, {
    status: result.status,
    error_type: result.error_type,
    feedback: result.feedback,
    verified_at: new Date().toISOString(),
  });

  let guidance: MathGuidance | null = null;
  if (result.victor_guidance) {
    guidance = mathStore.addGuidance({
      problem_id: problem.id,
      message: result.victor_guidance,
      guidance_type: "question",
      related_step_id: step.id,
    });
  }

  return NextResponse.json({ result, guidance });
}
