import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MathSessionSummary, MathSessionSummaryConcept } from "@/types/math-mode";

function getClaudeApiKey() {
  return process.env.CLAUDE_API_KEY || null;
}

function readFirstText(content: unknown): string {
  if (!Array.isArray(content) || content.length === 0) return "";
  return content
    .map((entry) => {
      if (!entry || typeof entry !== "object" || !("type" in entry)) return "";
      const block = entry as { type?: string; text?: unknown };
      return block.type === "text" && typeof block.text === "string"
        ? block.text
        : "";
    })
    .join("\n")
    .trim();
}

function toDisplayConcept(tag: string) {
  return tag
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export async function POST(request: Request) {
  const { userId } = await getAuthUser();
  if (!userId) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const problemId =
      typeof body?.problem_id === "string" ? body.problem_id : "";
    const sessionId =
      typeof body?.session_id === "string" ? body.session_id : "";

    if (!problemId) {
      return NextResponse.json(
        { error: "problem_id is required." },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();
    const [sessionResult, problemResult, stepsResult, guidanceResult] =
      await Promise.all([
        supabase
          .from("math_work_sessions")
          .select("id, started_at, completed_at, hints_used")
          .eq("problem_id", problemId)
          .eq("user_id", userId)
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("math_problems")
          .select("latex, problem_type")
          .eq("id", problemId)
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("math_steps")
          .select("id, step_number, latex, reasoning, status")
          .eq("problem_id", problemId)
          .eq("user_id", userId)
          .order("step_number", { ascending: true }),
        supabase
          .from("math_guidance")
          .select("related_step_id, guidance_type")
          .eq("problem_id", problemId)
          .eq("user_id", userId),
      ]);

    if (sessionResult.error || !sessionResult.data) {
      return NextResponse.json(
        { error: sessionResult.error?.message || "Session not found." },
        { status: 404 }
      );
    }
    if (sessionId && String(sessionResult.data.id) !== sessionId) {
      const { data: exactSession, error: exactSessionError } = await supabase
        .from("math_work_sessions")
        .select("id, started_at, completed_at, hints_used")
        .eq("id", sessionId)
        .eq("problem_id", problemId)
        .eq("user_id", userId)
        .maybeSingle();
      if (exactSessionError || !exactSession) {
        return NextResponse.json(
          { error: exactSessionError?.message || "Session not found." },
          { status: 404 }
        );
      }
      sessionResult.data = exactSession;
    }
    if (problemResult.error || !problemResult.data) {
      return NextResponse.json(
        { error: problemResult.error?.message || "Problem not found." },
        { status: 404 }
      );
    }
    if (stepsResult.error) {
      return NextResponse.json(
        { error: stepsResult.error.message },
        { status: 500 }
      );
    }
    if (guidanceResult.error) {
      return NextResponse.json(
        { error: guidanceResult.error.message },
        { status: 500 }
      );
    }

    const steps = Array.isArray(stepsResult.data) ? stepsResult.data : [];
    const meaningfulSteps = steps.filter(
      (step) =>
        String(step.latex || "").trim().length > 0 ||
        String(step.reasoning || "").trim().length > 0
    );
    const stepsTotal = meaningfulSteps.length;
    const correctedStepIds = new Set<string>();

    for (const row of Array.isArray(guidanceResult.data)
      ? guidanceResult.data
      : []) {
      if (
        String(row.guidance_type || "") === "correction" &&
        typeof row.related_step_id === "string"
      ) {
        correctedStepIds.add(row.related_step_id);
      }
    }

    const currentlyIncorrectIds = meaningfulSteps
      .filter((step) =>
        ["incorrect", "error", "partial"].includes(String(step.status || ""))
      )
      .map((step) => String(step.id));
    currentlyIncorrectIds.forEach((id) => correctedStepIds.add(id));

    const stepsRevised = correctedStepIds.size;
    const stepsCorrectFirstTry = Math.max(0, stepsTotal - stepsRevised);
    const hintsUsed = Number(sessionResult.data.hints_used || 0);
    const startedAt = new Date(String(sessionResult.data.started_at));
    const completedAt = sessionResult.data.completed_at
      ? new Date(String(sessionResult.data.completed_at))
      : new Date();
    const completionSeconds = Math.max(
      0,
      Math.round((completedAt.getTime() - startedAt.getTime()) / 1000)
    );

    const { data: conceptRows } = await supabase
      .from("math_concept_progress")
      .select("concept, mastery_level, times_encountered, last_encountered")
      .eq("user_id", userId)
      .gte("last_encountered", startedAt.toISOString())
      .order("times_encountered", { ascending: false })
      .limit(5);

    const concepts: MathSessionSummaryConcept[] = Array.isArray(conceptRows)
      ? conceptRows.map((row) => ({
          tag: String(row.concept || "general"),
          display_name: toDisplayConcept(String(row.concept || "general")),
          mastery_level: Math.max(
            0,
            Math.min(100, Number(row.mastery_level || 0))
          ),
        }))
      : [];

    let naturalSummary =
      "You completed this problem step by step and kept your work structured.";

    const apiKey = getClaudeApiKey();
    if (apiKey) {
      try {
        const anthropic = new Anthropic({ apiKey });
        const prompt = `The student solved ${String(problemResult.data.latex || "a math problem")}. They took ${stepsTotal} steps. ${stepsCorrectFirstTry} were correct on first attempt. ${stepsRevised} required revision. Concepts used: ${concepts.map((item) => item.display_name).join(", ") || "General math reasoning"}. Write two sentences summarizing their approach and what they demonstrated. Be specific and factual. Do not use generic praise.`;
        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 220,
          system:
            "You write concise, specific learning summaries. Return plain text only.",
          messages: [{ role: "user", content: prompt }],
        });
        const generated = readFirstText(response.content);
        if (generated) {
          naturalSummary = generated;
        }
      } catch {
        // Keep deterministic fallback summary.
      }
    }

    const summary: MathSessionSummary = {
      steps_total: stepsTotal,
      steps_correct_first_try: stepsCorrectFirstTry,
      steps_revised: stepsRevised,
      hints_used: hintsUsed,
      completion_time_seconds: completionSeconds,
      concepts,
      natural_summary: naturalSummary,
    };

    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to generate session summary.",
      },
      { status: 500 }
    );
  }
}
