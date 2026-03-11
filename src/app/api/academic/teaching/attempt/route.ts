import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildVictorHandoffContext,
  detectStruggle,
  type StudentAttempt,
  type SystemStep,
  type TeachingEngineRequest,
  type WorkspaceContext,
} from "@/lib/academic/teachingEngine";
import type { Subject } from "@/types/academic-studio";

type AttemptResult = "correct" | "partial" | "wrong" | "skipped";

function isAttemptResult(value: unknown): value is AttemptResult {
  return (
    value === "correct" ||
    value === "partial" ||
    value === "wrong" ||
    value === "skipped"
  );
}

function normalizeAttemptResult(
  rawResult: unknown,
  rawAttempt: string
): AttemptResult {
  const attempt = rawAttempt.trim();
  if (!attempt) return "skipped";
  if (isAttemptResult(rawResult)) return rawResult;

  const lower = attempt.toLowerCase();
  if (
    /(i\s*(don'?t|do not)\s*know|idk|unsure|not sure|confused|stuck|help)/.test(
      lower
    )
  ) {
    return "wrong";
  }

  return "partial";
}

function isWorkspace(value: unknown): value is WorkspaceContext {
  return value === "math" || value === "coding" || value === "paper" || value === "study";
}

function isSubject(value: unknown): value is Subject {
  return (
    value === "math" ||
    value === "science" ||
    value === "writing" ||
    value === "history" ||
    value === "computer-science" ||
    value === "general"
  );
}

function defaultWorkspaceForSubject(subject: Subject): WorkspaceContext {
  if (subject === "math") return "math";
  if (subject === "computer-science") return "coding";
  if (subject === "writing") return "paper";
  return "study";
}

async function upsertMathConceptProgressFromAttempt(input: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
  conceptTag: string;
  result: AttemptResult;
}) {
  const concept = (input.conceptTag || "general").trim() || "general";
  const isCorrect = input.result === "correct";

  const { data: existing } = await input.supabase
    .from("math_concept_progress")
    .select("id, times_encountered, times_correct, times_error")
    .eq("user_id", input.userId)
    .eq("concept", concept)
    .maybeSingle();

  const nextEncountered = Number(existing?.times_encountered || 0) + 1;
  const nextCorrect =
    Number(existing?.times_correct || 0) + (isCorrect ? 1 : 0);
  const nextError = Number(existing?.times_error || 0) + (isCorrect ? 0 : 1);
  const masteryLevel = Math.max(
    0,
    Math.min(100, Math.round((nextCorrect / Math.max(1, nextEncountered)) * 100))
  );

  if (existing?.id) {
    await input.supabase
      .from("math_concept_progress")
      .update({
        times_encountered: nextEncountered,
        times_correct: nextCorrect,
        times_error: nextError,
        mastery_level: masteryLevel,
        last_encountered: new Date().toISOString(),
      })
      .eq("id", existing.id);
    return;
  }

  await input.supabase.from("math_concept_progress").insert({
    user_id: input.userId,
    concept,
    times_encountered: nextEncountered,
    times_correct: nextCorrect,
    times_error: nextError,
    mastery_level: masteryLevel,
    last_encountered: new Date().toISOString(),
  });
}

async function upsertConceptStruggleEvent(input: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
  sessionId: string;
  conceptTag: string;
  workspaceContext: WorkspaceContext;
  subject: Subject;
  interventionReason: "auto" | "button";
  victorIntervened: boolean;
}) {
  const className = `${input.workspaceContext} workspace`;
  const struggleType =
    input.subject === "math"
      ? "reasoning_gap"
      : input.subject === "writing"
        ? "incomplete_understanding"
        : "misconception";
  const { data: existing } = await input.supabase
    .from("concept_struggles")
    .select("id, attempt_count")
    .eq("user_id", input.userId)
    .eq("session_id", input.sessionId)
    .eq("concept_tag", input.conceptTag)
    .eq("workspace_context", input.workspaceContext)
    .eq("subject", input.subject)
    .eq("resolved", false)
    .order("detected_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    await input.supabase
      .from("concept_struggles")
      .update({
        attempt_count: Number(existing.attempt_count || 0) + 1,
        intervention_reason: input.interventionReason,
        victor_intervened: input.victorIntervened,
        detected_at: new Date().toISOString(),
        class_name: className,
        concept: input.conceptTag,
        struggle_type: struggleType,
      })
      .eq("id", existing.id);
    return;
  }

  await input.supabase.from("concept_struggles").insert({
    user_id: input.userId,
    session_id: input.sessionId,
    concept_tag: input.conceptTag,
    workspace_context: input.workspaceContext,
    subject: input.subject,
    attempt_count: 1,
    victor_intervened: input.victorIntervened,
    intervention_reason: input.interventionReason,
    class_name: className,
    concept: input.conceptTag,
    struggle_type: struggleType,
    detected_at: new Date().toISOString(),
    resolved: false,
  });
}

async function resolveConceptStruggleEvent(input: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
  sessionId: string;
  conceptTag: string;
  workspaceContext: WorkspaceContext;
  subject: Subject;
}) {
  await input.supabase
    .from("concept_struggles")
    .update({ resolved: true })
    .eq("user_id", input.userId)
    .eq("session_id", input.sessionId)
    .eq("concept_tag", input.conceptTag)
    .eq("workspace_context", input.workspaceContext)
    .eq("subject", input.subject)
    .eq("resolved", false);
}

export async function POST(request: NextRequest) {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const body = await request.json();
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
  const stepNumber = Number(body?.stepNumber);
  const attemptText = typeof body?.attempt === "string" ? body.attempt.trim() : "";
  const result = normalizeAttemptResult(body?.result, attemptText);

  if (!sessionId || !Number.isFinite(stepNumber)) {
    return NextResponse.json(
      {
        success: false,
        error: "sessionId and stepNumber are required.",
      },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: session, error: fetchError } = await supabase
    .from("teaching_sessions")
    .select(
      "id, subject, problem_statement, steps, current_step_index, completed_at"
    )
    .eq("id", sessionId)
    .eq("user_id", userId)
    .single();

  if (fetchError || !session) {
    return NextResponse.json(
      { success: false, error: "Teaching session not found." },
      { status: 404 }
    );
  }

  const steps: SystemStep[] = Array.isArray(session.steps)
    ? (session.steps as SystemStep[])
    : [];

  const index = steps.findIndex((step) => step.stepNumber === stepNumber);
  if (index < 0) {
    return NextResponse.json(
      { success: false, error: "Step not found." },
      { status: 404 }
    );
  }

  const attempt: StudentAttempt = {
    stepNumber,
    attempt: attemptText,
    result,
    timestamp: new Date().toISOString(),
  };

  const step = steps[index];
  const nextAttempts = [...(step.studentAttempts || []), attempt];
  const nextStruggle = detectStruggle(
    { ...step, studentAttempts: step.studentAttempts || [] },
    attempt
  );

  const nextSteps = [...steps];
  nextSteps[index] = {
    ...step,
    studentAttempts: nextAttempts,
    struggleDetected: nextStruggle,
    revealed: true,
  };

  let nextCurrentStepIndex = Number(session.current_step_index) || 0;
  if (result === "correct" && nextSteps[index + 1]) {
    nextSteps[index + 1] = {
      ...nextSteps[index + 1],
      revealed: true,
    };
    nextCurrentStepIndex = Math.max(nextCurrentStepIndex, index + 1);
  }

  const { error: updateError } = await supabase
    .from("teaching_sessions")
    .update({
      steps: nextSteps,
      current_step_index: nextCurrentStepIndex,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("user_id", userId);

  if (updateError) {
    return NextResponse.json(
      { success: false, error: updateError.message },
      { status: 500 }
    );
  }

  const teachingRequest: TeachingEngineRequest = {
    content: session.problem_statement,
    subject: isSubject(session.subject) ? session.subject : "general",
    workspaceContext: isWorkspace(body?.workspaceContext)
      ? body.workspaceContext
      : defaultWorkspaceForSubject(
          isSubject(session.subject) ? session.subject : "general"
        ),
    studentHistory: nextSteps.flatMap((item) => item.studentAttempts || []),
  };

  if (teachingRequest.workspaceContext === "math") {
    try {
      await upsertMathConceptProgressFromAttempt({
        supabase,
        userId,
        conceptTag: nextSteps[index].conceptTag || "general",
        result,
      });
    } catch {
      // best-effort analytics update; do not block teaching flow
    }
  }

  let victorHandoffContext = null;
  if (nextStruggle) {
    victorHandoffContext = buildVictorHandoffContext(
      teachingRequest,
      nextSteps,
      index,
      "auto"
    );

    await upsertConceptStruggleEvent({
      supabase,
      userId,
      sessionId,
      conceptTag: nextSteps[index].conceptTag || "general",
      workspaceContext: teachingRequest.workspaceContext,
      subject: teachingRequest.subject,
      interventionReason: "auto",
      victorIntervened: false,
    });
  } else if (result === "correct") {
    await resolveConceptStruggleEvent({
      supabase,
      userId,
      sessionId,
      conceptTag: nextSteps[index].conceptTag || "general",
      workspaceContext: teachingRequest.workspaceContext,
      subject: teachingRequest.subject,
    });
  }

  return NextResponse.json(
    {
      success: true,
      struggleDetected: nextStruggle,
      victorHandoffContext,
      steps: nextSteps,
      currentStepIndex: nextCurrentStepIndex,
    },
    { status: 200 }
  );
}
