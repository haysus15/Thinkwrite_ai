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

function buildFallbackResult(step: { id: string; latex?: string }) {
  const hasLatex = Boolean(step?.latex?.trim());
  const result: MathVerificationResult = {
    step_id: step.id,
    is_correct: false,
    status: hasLatex ? "partial" : "error",
    error_type: hasLatex ? "procedural" : "notation",
    feedback: hasLatex
      ? "Step saved. AI verification is unavailable right now, so continue with your next justified move."
      : "Step is empty. Add a valid math expression before verification.",
    victor_guidance: hasLatex
      ? "What rule or theorem justifies this transformation?"
      : "Write your step in LaTeX, then explain why it is valid.",
  };
  return result;
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
  const step = body?.step;
  const allSteps = Array.isArray(body?.steps) ? body.steps : [];
  if (!problem || !step) {
    return NextResponse.json({ error: "Problem and step required" }, { status: 400 });
  }

  if (!apiKey) {
    const result = buildFallbackResult(step);
    mathStore.updateStep(step.id, {
      status: result.status,
      error_type: result.error_type,
      feedback: result.feedback,
      verified_at: new Date().toISOString(),
    });
    const guidance = mathStore.addGuidance({
      problem_id: problem.id,
      message: result.victor_guidance || "Continue with the next justified step.",
      guidance_type: "question",
      related_step_id: step.id,
    });
    return NextResponse.json({ result, guidance, fallback: true });
  }

  try {
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
Current Step: ${step.latex}
Current Reasoning: ${step.reasoning || ""}
Previous Steps:
${allSteps
  .filter((entry: { id: string }) => entry.id !== step.id)
  .map(
    (
      entry: {
        step_number?: number;
        latex?: string;
        reasoning?: string;
      },
      index: number
    ) =>
      `${entry.step_number ?? index + 1}. ${entry.latex || ""} (${entry.reasoning || "no reasoning"})`
  )
  .join("\n") || "None"}

Important:
- If the current step repeats an earlier step without progress, mark it as "error" with error_type "procedural".
- If the step text is empty, mark as "error" with error_type "notation".
- Give concrete feedback tied to this exact step, not a generic compliment.`,
        },
      ],
    });

    const text = response.content?.[0]?.text || "{}";
    const parsed = parseModelJson(text) || {};

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
  } catch (error) {
    const result = buildFallbackResult(step);
    mathStore.updateStep(step.id, {
      status: result.status,
      error_type: result.error_type,
      feedback: result.feedback,
      verified_at: new Date().toISOString(),
    });
    const guidance = mathStore.addGuidance({
      problem_id: problem.id,
      message: result.victor_guidance || "Continue with the next justified step.",
      guidance_type: "question",
      related_step_id: step.id,
    });
    return NextResponse.json({
      result,
      guidance,
      fallback: true,
      warning: "AI verification failed. Returned fallback feedback.",
    });
  }
}
