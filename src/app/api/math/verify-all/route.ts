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
  const steps = Array.isArray(body?.steps) ? body.steps : [];
  if (!problem || steps.length === 0) {
    return NextResponse.json({ error: "Problem and steps required" }, { status: 400 });
  }

  const anthropic = new Anthropic({ apiKey });
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 700,
    system: `You are Victor verifying a student's full solution.
Return strict JSON:
{
  "results": [
    {
      "step_id": "id",
      "status": "correct|error|partial",
      "error_type": "arithmetic|conceptual|procedural|notation|",
      "feedback": "short feedback"
    }
  ],
  "guidance": "Socratic summary guidance"
}
Do not provide the final answer. Be concise.`,
    messages: [
      {
        role: "user",
        content: `Problem: ${problem.latex}
Steps:
${steps
          .map((step: { id: string; latex: string; reasoning?: string }) =>
            `- ${step.id}: ${step.latex} (${step.reasoning || ""})`
          )
          .join("\n")}`,
      },
    ],
  });

  const text = response.content?.[0]?.text || "{}";
  const parsed = safeJsonParse(text) || {};
  const results: MathVerificationResult[] = Array.isArray(parsed.results)
    ? parsed.results.map((result: MathVerificationResult) => ({
        ...result,
        is_correct: result.status === "correct",
      }))
    : [];

  results.forEach((result) => {
    mathStore.updateStep(result.step_id, {
      status: result.status,
      error_type: result.error_type,
      feedback: result.feedback,
      verified_at: new Date().toISOString(),
    });
  });

  let guidance: MathGuidance | null = null;
  if (parsed.guidance) {
    guidance = mathStore.addGuidance({
      problem_id: problem.id,
      message: parsed.guidance,
      guidance_type: "concept",
    });
  }

  return NextResponse.json({ results, guidance });
}
