import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { MathVerificationResult } from "@/types/math-mode";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import {
  countConceptStrugglesInSession,
  countOpenConceptStruggles,
  countStepCorrections,
  createMathGuidance,
  getMathProblemCompletionStatus,
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
  createFallbackVerification,
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
  const step = body?.step;
  const allSteps = Array.isArray(body?.steps) ? body.steps : [];
  const teachingSessionId =
    typeof body?.teachingSessionId === "string" ? body.teachingSessionId : null;
  if (!problem || !step || !problem.id) {
    return NextResponse.json(
      { error: "Problem and step required" },
      { status: 400 }
    );
  }

  const apiKey = getClaudeApiKey();
  if (!apiKey) {
    const fallback = createFallbackVerification({
      stepId: step.id,
      hasLatex: Boolean(step?.latex?.trim()),
    });
    await updateMathStep(step.id, userId, {
      status: fallback.status,
      error_type: fallback.error_type,
      feedback: fallback.feedback,
      verified_at: new Date().toISOString(),
    });
    await updateWorkSessionCounts({ problemId: problem.id, userId });
    await upsertMathConceptProgress({
      userId,
      concept: String(problem.problem_type || "general"),
      isCorrect: fallback.is_correct,
    });
    const guidance = await createMathGuidance({
      userId,
      problemId: problem.id,
      message: fallback.victor_guidance || "Continue with one justified step.",
      guidanceType: "hint",
      relatedStepId: step.id,
    });
    return NextResponse.json({ result: fallback, guidance, fallback: true });
  }

  try {
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      system: `You verify one math step using confidence states.
Return strict JSON:
{
  "equivalent": true,
  "status": "correct|equivalent_form|likely_correct|incorrect|needs_recheck",
  "transformation_applied": "what changed in this step",
  "error_location": "where the error occurred or null",
  "correction_hint": "one sentence hint only, never the answer",
  "reason": "internal reasoning",
  "guidance": "one Socratic follow-up question",
  "confidence": 0-100
}
Rules:
- If mathematically valid and expected: correct.
- If valid but different algebraic form: equivalent_form.
- If likely valid but notation/edge-case uncertainty: likely_correct.
- Only use incorrect when transformation is invalid.`,
      messages: [
        {
          role: "user",
          content: `Problem: ${problem.latex || ""}
Current Step: ${step.latex || ""}
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
  .join("\n") || "None"}`,
        },
      ],
    });

    const parsed = parseModelJson(readFirstText(response.content) || "{}") || {};
    const previousStep = [...allSteps]
      .filter(
        (entry: { id: string; latex?: string; step_number?: number }) =>
          entry.id !== step.id && Boolean(entry.latex?.trim())
      )
      .sort(
        (a: { step_number?: number }, b: { step_number?: number }) =>
          (Number(a.step_number) || 0) - (Number(b.step_number) || 0)
      )
      .pop();

    let status = coerceVerificationStatus(parsed.status);
    const transformationApplied =
      typeof parsed.transformation_applied === "string"
        ? parsed.transformation_applied.trim()
        : "";
    const errorLocation =
      typeof parsed.error_location === "string"
        ? parsed.error_location.trim()
        : null;
    const correctionHint =
      typeof parsed.correction_hint === "string"
        ? parsed.correction_hint.trim()
        : null;
    let feedback = composeVerificationFeedback({
      status,
      transformationApplied,
      errorLocation,
      correctionHint,
      fallbackFeedback:
        "Review this transformation and validate the operation on both sides.",
    });
    let guidance =
      typeof parsed.guidance === "string" && parsed.guidance.trim()
        ? parsed.guidance.trim()
        : "What operation did you apply, and why is it valid here?";

    const reconciled = reconcileEquationPair({
      previousLatex: previousStep?.latex,
      currentLatex: step?.latex,
      currentStatus: status,
      feedback,
      guidance,
      problemType: String(problem?.problem_type || ""),
    });
    status = reconciled.status;
    feedback = reconciled.feedback;
    guidance = reconciled.guidance;

      const isCorrect = ["correct", "equivalent_form", "likely_correct"].includes(
        status
      );
    const result: MathVerificationResult = {
      step_id: step.id,
      is_correct: isCorrect,
      status,
      error_type: toLegacyErrorType(status),
      transformation_applied: transformationApplied || undefined,
      error_location: errorLocation,
      correction_hint: correctionHint,
      feedback,
      victor_guidance: guidance,
    };

    await updateMathStep(step.id, userId, {
      status,
      error_type: result.error_type,
      feedback,
      verified_at: new Date().toISOString(),
    });
    await updateWorkSessionCounts({ problemId: problem.id, userId });
    const concept = String(problem.problem_type || "general");
    await upsertMathConceptProgress({
      userId,
      concept,
      isCorrect,
    });

    let guidanceEntry = null;
    if (guidance) {
      guidanceEntry = await createMathGuidance({
        userId,
        problemId: problem.id,
        message: guidance,
        guidanceType: isCorrect ? "encouragement" : "correction",
        relatedStepId: step.id,
      });
    }
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
      | null = null;

    const masteryLevel = await getMathConceptMastery({ userId, concept });

    if (!isCorrect) {
      await recordConceptStruggle({
        userId,
        sessionId: teachingSessionId,
        concept,
        workspaceContext: "math",
        subject: "math",
        interventionReason: "auto",
      });

      const [stepCorrectionCount, sessionStruggleCount] =
        await Promise.all([
          countStepCorrections({ problemId: problem.id, stepId: step.id }),
          teachingSessionId
            ? countConceptStrugglesInSession({
                userId,
                sessionId: teachingSessionId,
                concept,
              })
            : countOpenConceptStruggles({
                userId,
                concept,
                workspaceContext: "math",
                subject: "math",
              }),
        ]);

      if (stepCorrectionCount >= 3) {
        victorTrigger = {
          reason: "repeated_error",
          message:
            `I noticed repeated errors on ${concept}. Want a guided breakdown of this step?`,
          concept,
        };
      } else if (sessionStruggleCount >= 2) {
        victorTrigger = {
          reason: "session_struggle",
          message: `I'm noticing a pattern on ${concept}. Want to address the core concept directly?`,
          concept,
        };
      }
    } else {
      await resolveConceptStruggles({
        userId,
        concept,
        sessionId: teachingSessionId,
        workspaceContext: "math",
        subject: "math",
      });
    }

    if (!victorTrigger && masteryLevel < 30) {
      victorTrigger = {
        reason: "low_mastery",
        message: `Before we continue, want a quick foundation check on ${concept}?`,
        concept,
      };
    }

    if (!victorTrigger) {
      const completion = await getMathProblemCompletionStatus({
        problemId: problem.id,
        userId,
      });
      if (completion.completed && completion.finalAnswerCorrect === false) {
        victorTrigger = {
          reason: "session_complete_errors",
          message: "Want to review where those steps went wrong?",
          concept,
        };
      }
    }

    return NextResponse.json({
      result,
      guidance: guidanceEntry,
      victorTrigger,
    });
  } catch (error) {
    const fallback = createFallbackVerification({
      stepId: step.id,
      hasLatex: Boolean(step?.latex?.trim()),
    });
    await updateMathStep(step.id, userId, {
      status: fallback.status,
      error_type: fallback.error_type,
      feedback: fallback.feedback,
      verified_at: new Date().toISOString(),
    });
    await updateWorkSessionCounts({ problemId: problem.id, userId });
    await upsertMathConceptProgress({
      userId,
      concept: String(problem.problem_type || "general"),
      isCorrect: fallback.is_correct,
    });
    const guidance = await createMathGuidance({
      userId,
      problemId: problem.id,
      message:
        fallback.victor_guidance || "Continue with one justified transformation.",
      guidanceType: "hint",
      relatedStepId: step.id,
    });
    return NextResponse.json({
      result: fallback,
      guidance,
      fallback: true,
      warning:
        error instanceof Error
          ? error.message
          : "AI verification unavailable. Using fallback feedback.",
    });
  }
}
