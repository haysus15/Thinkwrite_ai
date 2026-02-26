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

function parseModelJson(text: string) {
  const direct = safeJsonParse(text);
  if (direct) return direct;

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    const parsed = safeJsonParse(fenced[1].trim());
    if (parsed) return parsed;
  }

  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch?.[0]) {
    const parsed = safeJsonParse(objectMatch[0]);
    if (parsed) return parsed;
  }

  return null;
}

function buildFallbackResults(
  steps: Array<{ id: string; latex?: string }>
): MathVerificationResult[] {
  return steps.map((step) => {
    const hasLatex = Boolean(step?.latex?.trim());
    return {
      step_id: step.id,
      is_correct: false,
      status: hasLatex ? "partial" : "error",
      error_type: hasLatex ? "procedural" : "notation",
      feedback: hasLatex
        ? "Step saved. AI verification is unavailable right now, so continue with your next justified move."
        : "Step is empty. Add a valid math expression before verification.",
    };
  });
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

  const body = await request.json();
  const problem = body?.problem;
  const steps = Array.isArray(body?.steps) ? body.steps : [];
  if (!problem || steps.length === 0) {
    return NextResponse.json({ error: "Problem and steps required" }, { status: 400 });
  }

  if (!apiKey) {
    const results = buildFallbackResults(steps);
    results.forEach((result) => {
      mathStore.updateStep(result.step_id, {
        status: result.status,
        error_type: result.error_type,
        feedback: result.feedback,
        verified_at: new Date().toISOString(),
      });
    });
    const guidance = mathStore.addGuidance({
      problem_id: problem.id,
      message:
        "AI verification is unavailable right now. Continue by justifying each transformation step-by-step.",
      guidance_type: "concept",
    });
    return NextResponse.json({ results, guidance, fallback: true });
  }

  try {
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
    const parsed = parseModelJson(text) || {};
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
  } catch (error) {
    const results = buildFallbackResults(steps);
    results.forEach((result) => {
      mathStore.updateStep(result.step_id, {
        status: result.status,
        error_type: result.error_type,
        feedback: result.feedback,
        verified_at: new Date().toISOString(),
      });
    });
    const guidance = mathStore.addGuidance({
      problem_id: problem.id,
      message:
        "AI verification failed. Keep going step-by-step and justify each rule before the next transformation.",
      guidance_type: "concept",
    });
    return NextResponse.json({
      results,
      guidance,
      fallback: true,
      warning: "AI verification failed. Returned fallback feedback.",
    });
  }
}
