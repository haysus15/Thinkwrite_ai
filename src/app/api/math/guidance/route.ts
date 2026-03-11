import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createMathGuidance, incrementHintUsage } from "@/lib/math-mode/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function getClaudeApiKey() {
  return process.env.CLAUDE_API_KEY || null;
}

function readFirstText(content: unknown): string {
  if (!Array.isArray(content) || content.length === 0) return "";
  const joined = content
    .map((entry) => {
      if (!entry || typeof entry !== "object" || !("type" in entry)) return "";
      const block = entry as { type?: string; text?: unknown };
      return block.type === "text" && typeof block.text === "string"
        ? block.text
        : "";
    })
    .join("\n")
    .trim();
  return joined;
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
  if (!problem?.id) {
    return NextResponse.json({ error: "Problem id required" }, { status: 400 });
  }
  const steps = Array.isArray(body?.steps) ? body.steps : [];
  const requestedStepNumber = Number(body?.step_number);
  const hasRequestedStepNumber = Number.isFinite(requestedStepNumber);
  const targetStep = hasRequestedStepNumber
    ? steps.find(
        (step: { step_number?: number }) =>
          Number(step.step_number) === requestedStepNumber
      ) || null
    : null;

  const anthropic = new Anthropic({ apiKey });
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 200,
    system: `You are Victor. Provide one Socratic question or hint to move the student forward. Do not solve the problem. Keep it short.`,
    messages: [
      {
        role: "user",
        content: `Problem: ${problem?.latex || ""}
${targetStep ? `Current step (${requestedStepNumber}): ${targetStep?.latex || "[blank]"}\n` : ""}
Steps so far: ${steps.map((step: { latex: string }) => step.latex).join("; ")}`,
      },
    ],
  });

  const message =
    readFirstText(response.content) ||
    "State your next step and justify it.";
  const guidance = await createMathGuidance({
    userId,
    problemId: problem.id,
    message,
    guidanceType: "hint",
    relatedStepId:
      targetStep && typeof targetStep.id === "string" ? targetStep.id : undefined,
  });
  await incrementHintUsage(problem.id, userId);

  return NextResponse.json({ guidance });
}

export async function GET(request: NextRequest) {
  const { userId } = await getAuthUser();
  if (!userId) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  const problemId = request.nextUrl.searchParams.get("problem_id");
  if (!problemId) {
    return NextResponse.json(
      { error: "problem_id is required" },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("math_guidance")
    .select("*")
    .eq("user_id", userId)
    .eq("problem_id", problemId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ guidance: data || [] });
}
