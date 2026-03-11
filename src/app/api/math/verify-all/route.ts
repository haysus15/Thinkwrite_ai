import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { MathVerificationResult, StepStatus } from "@/types/math-mode";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  countStepCorrections,
  countConceptStrugglesInSession,
  countOpenConceptStruggles,
  createMathGuidance,
  getMathConceptMastery,
  recordConceptStruggle,
  resolveConceptStruggles,
  updateMathStep,
  updateWorkSessionCounts,
  upsertMathConceptProgress,
} from "@/lib/math-mode/db";
import {
  coerceVerificationStatus,
  composeVerificationFeedback,
  reconcileEquationPair,
  toLegacyErrorType,
} from "@/lib/math-mode/verificationEngine";

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

export async function POST(request: Request) {
  const { userId } = await getAuthUser();
  if (!userId) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  const body = await request.json();
  const problem = body?.problem;
  const steps = Array.isArray(body?.steps) ? body.steps : [];
  const teachingSessionId =
    typeof body?.teachingSessionId === "string" ? body.teachingSessionId : null;
  if (!problem?.id || steps.length === 0) {
    return NextResponse.json(
      { error: "Problem and steps required" },
      { status: 400 }
    );
  }

  const apiKey = getClaudeApiKey();
  const results: MathVerificationResult[] = [];
  const supabase = await createSupabaseServerClient();

  if (apiKey) {
    try {
      const anthropic = new Anthropic({ apiKey });
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 900,
        system: `You verify a full math solution.
Return strict JSON:
{
  "results": [
    {
      "step_id": "id",
      "equivalent": true,
      "status": "correct|equivalent_form|likely_correct|incorrect|needs_recheck",
      "transformation_applied": "what changed in this step",
      "error_location": "where the error occurred or null",
      "correction_hint": "one sentence hint only, never the answer",
      "reason": "internal reasoning"
    }
  ],
  "guidance": "short Socratic summary"
}`,
        messages: [
          {
            role: "user",
            content: `Problem: ${problem.latex || ""}
Steps:
${steps
  .map(
    (step: { id: string; step_number?: number; latex?: string; reasoning?: string }) =>
      `${step.step_number || 0}. [${step.id}] ${step.latex || ""} (${step.reasoning || "no reasoning"})`
  )
  .join("\n")}`,
          },
        ],
      });

      const parsed = parseModelJson(readFirstText(response.content) || "{}") || {};
      const resultMap = new Map<string, MathVerificationResult>();
      if (Array.isArray(parsed.results)) {
        parsed.results.forEach((item: Record<string, unknown>) => {
          const stepId = String(item.step_id || "");
          if (!stepId) return;
          const status = coerceVerificationStatus(item.status);
          const transformationApplied =
            typeof item.transformation_applied === "string"
              ? item.transformation_applied.trim()
              : "";
          const errorLocation =
            typeof item.error_location === "string"
              ? item.error_location.trim()
              : null;
          const correctionHint =
            typeof item.correction_hint === "string"
              ? item.correction_hint.trim()
              : null;
          resultMap.set(stepId, {
            step_id: stepId,
            status,
            is_correct:
              status === "correct" ||
              status === "equivalent_form" ||
              status === "likely_correct",
            error_type: toLegacyErrorType(status),
            transformation_applied: transformationApplied || undefined,
            error_location: errorLocation,
            correction_hint: correctionHint,
            feedback: composeVerificationFeedback({
              status,
              transformationApplied,
              errorLocation,
              correctionHint,
              fallbackFeedback: "Check this transformation before continuing.",
            }),
          });
        });
      }

      for (let i = 0; i < steps.length; i += 1) {
        const step = steps[i];
        const fallbackStatus: StepStatus = step?.latex?.trim()
          ? "likely_correct"
          : "incorrect";
        const base =
          resultMap.get(step.id) ||
          ({
            step_id: step.id,
            status: fallbackStatus,
            is_correct: [
              "correct",
              "equivalent_form",
              "likely_correct",
            ].includes(fallbackStatus),
            error_type: toLegacyErrorType(fallbackStatus),
            feedback: composeVerificationFeedback({
              status: fallbackStatus,
              transformationApplied:
                fallbackStatus === "incorrect"
                  ? "no transformation was submitted"
                  : "you applied a valid-looking transformation",
              errorLocation:
                fallbackStatus === "incorrect"
                  ? "the current step input is empty"
                  : null,
              correctionHint:
                fallbackStatus === "incorrect"
                  ? "Enter one transformation before verifying."
                  : "Confirm notation and arithmetic before moving on.",
            }),
          } as MathVerificationResult);

        if (i > 0) {
          const prev = steps[i - 1];
          if (prev?.latex?.trim() && step?.latex?.trim()) {
            const reconciled = reconcileEquationPair({
              previousLatex: prev.latex,
              currentLatex: step.latex,
              currentStatus: base.status,
              feedback: base.feedback,
              guidance: "Check operation legality and notation.",
              problemType: String(problem?.problem_type || ""),
            });
            base.status = reconciled.status;
            base.feedback = reconciled.feedback;
            base.is_correct =
              base.status === "correct" ||
              base.status === "equivalent_form" ||
              base.status === "likely_correct";
            base.error_type = toLegacyErrorType(base.status);
          }
        }

        results.push(base);
      }

      if (typeof parsed.guidance === "string" && parsed.guidance.trim()) {
        await createMathGuidance({
          userId,
          problemId: problem.id,
          message: parsed.guidance.trim(),
          guidanceType: "hint",
        });
      }
    } catch {
      // fallback below
    }
  }

  if (results.length === 0) {
    steps.forEach((step: { id: string; latex?: string }) => {
      const status: StepStatus = step?.latex?.trim() ? "likely_correct" : "incorrect";
      results.push({
        step_id: step.id,
        is_correct: ["correct", "equivalent_form", "likely_correct"].includes(
          status
        ),
        status,
        error_type: toLegacyErrorType(status),
        feedback: composeVerificationFeedback({
          status,
          transformationApplied:
            status === "incorrect"
              ? "no transformation was submitted"
              : "you applied a valid-looking transformation",
          errorLocation:
            status === "incorrect" ? "the current step input is empty" : null,
          correctionHint:
            status === "incorrect"
              ? "Enter one transformation before verifying."
              : "Confirm notation and arithmetic before continuing.",
        }),
      });
    });
    await createMathGuidance({
      userId,
      problemId: problem.id,
      message:
        "AI verification is limited right now. Keep one justified transformation per line.",
      guidanceType: "hint",
    });
  }

  const concept = String(problem.problem_type || "general");
  const incorrectStepIds: string[] = [];
  for (const result of results) {
    await updateMathStep(result.step_id, userId, {
      status: result.status,
      error_type: result.error_type,
      feedback: result.feedback,
      verified_at: new Date().toISOString(),
    });
    await upsertMathConceptProgress({
      userId,
      concept,
      isCorrect: result.is_correct,
    });

    if (
      result.status === "incorrect" ||
      result.status === "error" ||
      result.status === "partial"
    ) {
      incorrectStepIds.push(result.step_id);
      await createMathGuidance({
        userId,
        problemId: problem.id,
        message: result.feedback || "Re-check this transformation.",
        guidanceType: "correction",
        relatedStepId: result.step_id,
      });
    }
  }

  await updateWorkSessionCounts({ problemId: problem.id, userId });

  const { data: allStepRows } = await supabase
    .from("math_steps")
    .select("status, latex, reasoning")
    .eq("problem_id", problem.id)
    .eq("user_id", userId);
  const meaningfulRows = Array.isArray(allStepRows)
    ? allStepRows.filter((row) => {
        const typed = row as { latex?: string | null; reasoning?: string | null };
        return Boolean(String(typed.latex || "").trim()) || Boolean(String(typed.reasoning || "").trim());
      })
    : [];
  const allStatuses = meaningfulRows.map((row) =>
    String((row as { status?: string }).status || "")
  );
  const hasPendingOverall = allStatuses.some(
    (status) => status === "unchecked" || status === "needs_recheck"
  );
  const hasIncorrectOverall = allStatuses.some(
    (status) => status === "incorrect" || status === "error" || status === "partial"
  );

  let victorTrigger:
    | {
        reason:
          | "repeated_error"
          | "low_mastery"
          | "session_struggle"
          | "session_complete_errors";
        message: string;
        concept: string;
      }
    | null = !hasPendingOverall && hasIncorrectOverall
    ? {
        reason: "session_complete_errors",
        message: "Want to review where those steps went wrong?",
        concept,
      }
    : null;

  if (!victorTrigger && incorrectStepIds.length > 0) {
    for (const stepId of incorrectStepIds) {
      const correctionCount = await countStepCorrections({
        problemId: problem.id,
        stepId,
      });
      if (correctionCount >= 3) {
        victorTrigger = {
          reason: "repeated_error",
          message: `I noticed repeated errors on ${concept}. Want a guided breakdown of this step?`,
          concept,
        };
        break;
      }
    }
  }

  if (!hasPendingOverall && hasIncorrectOverall) {
    await recordConceptStruggle({
      userId,
      sessionId: teachingSessionId,
      concept,
      workspaceContext: "math",
      subject: "math",
      interventionReason: "auto",
    });
  } else if (!hasPendingOverall && !hasIncorrectOverall) {
    await resolveConceptStruggles({
      userId,
      concept,
      sessionId: teachingSessionId,
      workspaceContext: "math",
      subject: "math",
    });
  }

  if (!victorTrigger) {
    const sessionStruggleCount = teachingSessionId
      ? await countConceptStrugglesInSession({
          userId,
          sessionId: teachingSessionId,
          concept,
        })
      : await countOpenConceptStruggles({
          userId,
          concept,
          workspaceContext: "math",
          subject: "math",
        });

    if (sessionStruggleCount >= 2) {
      victorTrigger = {
        reason: "session_struggle",
        message: `I'm noticing a pattern on ${concept}. Want to address the core concept directly?`,
        concept,
      };
    }
  }

  if (!victorTrigger) {
    const masteryLevel = await getMathConceptMastery({ userId, concept });
    if (masteryLevel < 30) {
      victorTrigger = {
        reason: "low_mastery",
        message: `Before we continue, want a quick foundation check on ${concept}?`,
        concept,
      };
    }
  }

  return NextResponse.json({ results, victorTrigger });
}
