import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildVictorHandoffContext,
  type TeachingEngineRequest,
  type WorkspaceContext,
  type SystemStep,
} from "@/lib/academic/teachingEngine";
import type { Subject } from "@/types/academic-studio";

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

  if (!sessionId || !Number.isFinite(stepNumber)) {
    return NextResponse.json(
      { success: false, error: "sessionId and stepNumber are required." },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: session, error: fetchError } = await supabase
    .from("teaching_sessions")
    .select("id, subject, problem_statement, steps")
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
  const stepIndex = steps.findIndex((step) => step.stepNumber === stepNumber);
  if (stepIndex < 0) {
    return NextResponse.json(
      { success: false, error: "Step not found." },
      { status: 404 }
    );
  }

  const engineRequest: TeachingEngineRequest = {
    content: session.problem_statement,
    subject: isSubject(session.subject) ? session.subject : "general",
    workspaceContext: isWorkspace(body?.workspaceContext)
      ? body.workspaceContext
      : defaultWorkspaceForSubject(
          isSubject(session.subject) ? session.subject : "general"
        ),
    studentHistory: steps.flatMap((step) => step.studentAttempts || []),
  };

  const victorHandoffContext = buildVictorHandoffContext(
    engineRequest,
    steps,
    stepIndex,
    "button"
  );

  await upsertConceptStruggleEvent({
    supabase,
    userId,
    sessionId,
    conceptTag: steps[stepIndex]?.conceptTag || "general",
    workspaceContext: engineRequest.workspaceContext,
    subject: engineRequest.subject,
    interventionReason: "button",
    victorIntervened: true,
  });

  return NextResponse.json(
    {
      success: true,
      victorHandoffContext,
    },
    { status: 200 }
  );
}
