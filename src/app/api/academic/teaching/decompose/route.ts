import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  decomposeIntoSteps,
  type SystemStep,
  type TeachingEngineRequest,
  type WorkspaceContext,
} from "@/lib/academic/teachingEngine";
import type { Subject } from "@/types/academic-studio";

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

function isWorkspace(value: unknown): value is WorkspaceContext {
  return value === "math" || value === "coding" || value === "paper" || value === "study";
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
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  const subject = isSubject(body?.subject) ? body.subject : null;
  const workspaceContext = isWorkspace(body?.workspaceContext)
    ? body.workspaceContext
    : null;

  if (!content || !subject || !workspaceContext) {
    return NextResponse.json(
      {
        success: false,
        error: "content, subject, and workspaceContext are required.",
      },
      { status: 400 }
    );
  }

  const engineRequest: TeachingEngineRequest = {
    content,
    subject,
    workspaceContext,
    studentHistory: [],
  };

  const steps = await decomposeIntoSteps(engineRequest);
  const normalizedSteps: SystemStep[] = steps.map((step, index) => ({
    ...step,
    revealed: index === 0,
    studentAttempts: [],
    struggleDetected: false,
  }));

  const supabase = await createSupabaseServerClient();
  const { data, error: insertError } = await supabase
    .from("teaching_sessions")
    .insert({
      user_id: userId,
      subject,
      problem_statement: content,
      steps: normalizedSteps,
      current_step_index: 0,
      understanding_profile: {
        strongConcepts: [],
        gapConcepts: [],
        misconceptions: [],
        retriedSteps: [],
      },
      completed_at: null,
    })
    .select("id")
    .single();

  if (insertError || !data) {
    return NextResponse.json(
      { success: false, error: insertError?.message || "Failed to save session." },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      success: true,
      steps: normalizedSteps,
      sessionId: data.id,
    },
    { status: 200 }
  );
}
