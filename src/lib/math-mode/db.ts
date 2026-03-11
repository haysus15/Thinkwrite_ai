import type {
  MathGuidance,
  MathPractice,
  MathProblem,
  MathProblemSet,
  MathStep,
  StepStatus,
} from "@/types/math-mode";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function normalizeStepStatus(value: unknown): StepStatus {
  switch (value) {
    case "correct":
    case "equivalent_form":
    case "likely_correct":
    case "incorrect":
    case "needs_recheck":
    case "error":
    case "partial":
      return value;
    default:
      return "unchecked";
  }
}

function mapProblem(row: Record<string, unknown>): MathProblem {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    problem_set_id:
      row.problem_set_id == null ? null : String(row.problem_set_id),
    set_order:
      row.set_order == null ? null : Number(row.set_order),
    latex: String(row.latex || ""),
    plain_text: row.plain_text ? String(row.plain_text) : undefined,
    problem_type: row.problem_type
      ? (String(row.problem_type) as MathProblem["problem_type"])
      : undefined,
    graph_expression: row.graph_expression
      ? String(row.graph_expression)
      : undefined,
    graph_visible: Boolean(row.graph_visible),
    completed: Boolean(row.completed),
    final_answer_correct:
      row.final_answer_correct == null
        ? undefined
        : Boolean(row.final_answer_correct),
    created_at: String(row.created_at),
    completed_at: row.completed_at ? String(row.completed_at) : undefined,
  };
}

function mapProblemSet(row: Record<string, unknown>): MathProblemSet {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    title: String(row.title || "Untitled worksheet"),
    class_name: row.class_name == null ? null : String(row.class_name),
    assignment_prompt:
      row.assignment_prompt == null ? null : String(row.assignment_prompt),
    problem_count:
      row.problem_count == null ? null : Number(row.problem_count),
    source_type: String(row.source_type || "manual") as MathProblemSet["source_type"],
    source_raw: row.source_raw == null ? null : String(row.source_raw),
    status: String(row.status || "in_progress") as MathProblemSet["status"],
    completed_at: row.completed_at == null ? null : String(row.completed_at),
    created_at: String(row.created_at),
    updated_at: row.updated_at == null ? null : String(row.updated_at),
  };
}

function mapStep(row: Record<string, unknown>): MathStep {
  return {
    id: String(row.id),
    problem_id: String(row.problem_id),
    user_id: String(row.user_id),
    step_number: Number(row.step_number || 0),
    latex: String(row.latex || ""),
    plain_text: row.plain_text ? String(row.plain_text) : undefined,
    reasoning: row.reasoning ? String(row.reasoning) : undefined,
    status: normalizeStepStatus(row.status),
    error_type: row.error_type ? (String(row.error_type) as MathStep["error_type"]) : undefined,
    feedback: row.feedback ? String(row.feedback) : undefined,
    created_at: String(row.created_at),
    verified_at: row.verified_at ? String(row.verified_at) : undefined,
    is_final_answer:
      row.is_final_answer == null ? undefined : Boolean(row.is_final_answer),
  };
}

function mapGuidance(row: Record<string, unknown>): MathGuidance {
  return {
    id: String(row.id),
    problem_id: String(row.problem_id),
    message: String(row.message || ""),
    guidance_type: String(row.guidance_type || "question") as MathGuidance["guidance_type"],
    related_step_id: row.related_step_id ? String(row.related_step_id) : undefined,
    created_at: String(row.created_at),
  };
}

function mapPractice(row: Record<string, unknown>): MathPractice {
  return {
    id: String(row.id),
    latex: String(row.latex || ""),
    plain_text: row.plain_text ? String(row.plain_text) : undefined,
    problem_type: row.problem_type
      ? (String(row.problem_type) as MathPractice["problem_type"])
      : undefined,
    difficulty: String(row.difficulty || "same") as MathPractice["difficulty"],
    attempted: Boolean(row.attempted),
    completed: Boolean(row.completed),
  };
}

export async function listMathProblems(userId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("math_problems")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return Array.isArray(data) ? data.map((row) => mapProblem(row as Record<string, unknown>)) : [];
}

export async function createMathProblem(input: {
  userId: string;
  latex: string;
  plainText?: string;
  problemType?: string;
  graphExpression?: string;
  graphVisible?: boolean;
  problemSetId?: string | null;
  setOrder?: number | null;
}) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("math_problems")
    .insert({
      user_id: input.userId,
      latex: input.latex,
      plain_text: input.plainText || null,
      problem_type: input.problemType || null,
      graph_expression: input.graphExpression || null,
      graph_visible: input.graphVisible ?? true,
      problem_set_id: input.problemSetId || null,
      set_order:
        input.setOrder == null ? null : Number(input.setOrder),
      completed: false,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message || "Failed to create math problem.");

  await supabase.from("math_work_sessions").insert({
    user_id: input.userId,
    problem_id: data.id,
    status: "in_progress",
    total_steps: 0,
    correct_steps: 0,
    hints_used: 0,
  });

  return mapProblem(data as Record<string, unknown>);
}

export async function getMathProblem(problemId: string, userId: string) {
  const supabase = await createSupabaseServerClient();
  const [problemResult, stepResult, guidanceResult] = await Promise.all([
    supabase
      .from("math_problems")
      .select("*")
      .eq("id", problemId)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("math_steps")
      .select("*")
      .eq("problem_id", problemId)
      .eq("user_id", userId)
      .order("step_number", { ascending: true }),
    supabase
      .from("math_guidance")
      .select("*")
      .eq("problem_id", problemId)
      .order("created_at", { ascending: true }),
  ]);

  if (problemResult.error) throw new Error(problemResult.error.message);
  if (!problemResult.data) return null;

  if (stepResult.error) throw new Error(stepResult.error.message);
  if (guidanceResult.error) throw new Error(guidanceResult.error.message);

  return {
    problem: mapProblem(problemResult.data as Record<string, unknown>),
    steps: Array.isArray(stepResult.data)
      ? stepResult.data.map((row) => mapStep(row as Record<string, unknown>))
      : [],
    guidance: Array.isArray(guidanceResult.data)
      ? guidanceResult.data.map((row) => mapGuidance(row as Record<string, unknown>))
      : [],
  };
}

export async function updateMathProblem(problemId: string, userId: string, updates: Record<string, unknown>) {
  const supabase = await createSupabaseServerClient();
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if ("latex" in updates) payload.latex = updates.latex;
  if ("plain_text" in updates) payload.plain_text = updates.plain_text;
  if ("problem_type" in updates) payload.problem_type = updates.problem_type;
  if ("graph_expression" in updates) payload.graph_expression = updates.graph_expression;
  if ("graph_visible" in updates) payload.graph_visible = Boolean(updates.graph_visible);
  if ("completed" in updates) payload.completed = Boolean(updates.completed);
  if ("final_answer_correct" in updates) {
    payload.final_answer_correct =
      updates.final_answer_correct == null
        ? null
        : Boolean(updates.final_answer_correct);
  }
  if ("completed_at" in updates) payload.completed_at = updates.completed_at;
  if ("problem_set_id" in updates) payload.problem_set_id = updates.problem_set_id;
  if ("set_order" in updates) payload.set_order = updates.set_order;

  const { data, error } = await supabase
    .from("math_problems")
    .update(payload)
    .eq("id", problemId)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message || "Failed to update math problem.");

  if (payload.completed || payload.completed_at) {
    await supabase
      .from("math_work_sessions")
      .update({
        status: "completed",
        completed_at: payload.completed_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("problem_id", problemId)
      .eq("user_id", userId)
      .in("status", ["in_progress", "review"]);
  }

  return mapProblem(data as Record<string, unknown>);
}

export async function deleteMathProblem(problemId: string, userId: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("math_problems")
    .delete()
    .eq("id", problemId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function getMathProblemCompletionStatus(input: {
  problemId: string;
  userId: string;
}) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("math_problems")
    .select("completed, final_answer_correct")
    .eq("id", input.problemId)
    .eq("user_id", input.userId)
    .maybeSingle();
  return {
    completed: Boolean(data?.completed),
    finalAnswerCorrect:
      data?.final_answer_correct == null
        ? null
        : Boolean(data.final_answer_correct),
  };
}

export async function createMathStep(input: {
  userId: string;
  problemId: string;
  stepNumber: number;
  latex: string;
  reasoning?: string;
}) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("math_steps")
    .insert({
      user_id: input.userId,
      problem_id: input.problemId,
      step_number: input.stepNumber,
      latex: input.latex,
      reasoning: input.reasoning || null,
      status: "unchecked",
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message || "Failed to create math step.");
  await updateWorkSessionCounts({ problemId: input.problemId, userId: input.userId });

  return mapStep(data as Record<string, unknown>);
}

export async function updateMathStep(stepId: string, userId: string, updates: Record<string, unknown>) {
  const supabase = await createSupabaseServerClient();
  const payload: Record<string, unknown> = {};
  if ("latex" in updates) payload.latex = updates.latex;
  if ("plain_text" in updates) payload.plain_text = updates.plain_text;
  if ("reasoning" in updates) payload.reasoning = updates.reasoning;
  if ("status" in updates) payload.status = updates.status;
  if ("error_type" in updates) payload.error_type = updates.error_type;
  if ("feedback" in updates) payload.feedback = updates.feedback;
  if ("verified_at" in updates) payload.verified_at = updates.verified_at;
  if ("invalidated_at" in updates) payload.invalidated_at = updates.invalidated_at;
  if ("is_final_answer" in updates) {
    payload.is_final_answer = Boolean(updates.is_final_answer);
  }

  const { data, error } = await supabase
    .from("math_steps")
    .update(payload)
    .eq("id", stepId)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message || "Failed to update math step.");
  return mapStep(data as Record<string, unknown>);
}

export async function deleteMathStep(stepId: string, userId: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("math_steps")
    .delete()
    .eq("id", stepId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function invalidateDownstreamSteps(input: {
  userId: string;
  problemId: string;
  stepNumber: number;
}) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("math_steps")
    .update({
      status: "needs_recheck",
      invalidated_at: new Date().toISOString(),
      verified_at: null,
    })
    .eq("problem_id", input.problemId)
    .eq("user_id", input.userId)
    .gt("step_number", input.stepNumber);
  if (error) throw new Error(error.message);
}

export async function createMathGuidance(input: {
  userId: string;
  problemId: string;
  message: string;
  guidanceType: string;
  relatedStepId?: string;
}) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("math_guidance")
    .insert({
      user_id: input.userId,
      problem_id: input.problemId,
      message: input.message,
      guidance_type: input.guidanceType,
      related_step_id: input.relatedStepId || null,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message || "Failed to create guidance.");
  return mapGuidance(data as Record<string, unknown>);
}

export async function incrementHintUsage(problemId: string, userId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("math_work_sessions")
    .select("id, hints_used")
    .eq("problem_id", problemId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.id) return;
  await supabase
    .from("math_work_sessions")
    .update({
      hints_used: Number(data.hints_used || 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", data.id);
}

export async function updateWorkSessionCounts(input: {
  problemId: string;
  userId: string;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: steps, error } = await supabase
    .from("math_steps")
    .select("status, latex, reasoning, verified_at")
    .eq("problem_id", input.problemId)
    .eq("user_id", input.userId);
  if (error) return;
  const meaningfulSteps = Array.isArray(steps)
    ? steps.filter(
        (step) =>
          Boolean(String(step.latex || "").trim()) ||
          Boolean(String(step.reasoning || "").trim()) ||
          Boolean(step.verified_at)
      )
    : [];
  const total = meaningfulSteps.length;
  const correct = meaningfulSteps.filter((step) =>
    ["correct", "equivalent_form"].includes(String(step.status))
  ).length;
  const hasPending = meaningfulSteps.some((step) =>
    ["unchecked", "needs_recheck"].includes(String(step.status))
  );
  const hasIncorrect = meaningfulSteps.some((step) =>
    ["incorrect", "error", "partial"].includes(String(step.status))
  );
  const sessionStatus =
    total > 0 && !hasPending && hasIncorrect ? "review" : "in_progress";
  const { data: session } = await supabase
    .from("math_work_sessions")
    .select("id")
    .eq("problem_id", input.problemId)
    .eq("user_id", input.userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!session?.id) return;
  await supabase
    .from("math_work_sessions")
    .update({
      total_steps: total,
      correct_steps: correct,
      status: sessionStatus,
      completed_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.id);
}

export async function markFinalAnswerAndComplete(input: {
  userId: string;
  problemId: string;
  stepId: string;
}) {
  const supabase = await createSupabaseServerClient();
  const nowIso = new Date().toISOString();

  const { data: targetStep, error: targetError } = await supabase
    .from("math_steps")
    .select("id, step_number, status")
    .eq("id", input.stepId)
    .eq("problem_id", input.problemId)
    .eq("user_id", input.userId)
    .maybeSingle();
  if (targetError || !targetStep) {
    throw new Error("Final answer step not found.");
  }

  if (
    !["correct", "equivalent_form"].includes(String(targetStep.status || ""))
  ) {
    throw new Error(
      "Only correct or equivalent steps can be marked as final answer."
    );
  }

  const { data: maxStep } = await supabase
    .from("math_steps")
    .select("step_number")
    .eq("problem_id", input.problemId)
    .eq("user_id", input.userId)
    .order("step_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (Number(maxStep?.step_number || 0) !== Number(targetStep.step_number)) {
    throw new Error("Only the last step can be marked as final answer.");
  }

  const { error: clearError } = await supabase
    .from("math_steps")
    .update({ is_final_answer: false })
    .eq("problem_id", input.problemId)
    .eq("user_id", input.userId)
    .neq("id", input.stepId);
  if (clearError) throw new Error(clearError.message);

  const { data: finalStep, error: finalStepError } = await supabase
    .from("math_steps")
    .update({ is_final_answer: true, verified_at: nowIso })
    .eq("id", input.stepId)
    .eq("problem_id", input.problemId)
    .eq("user_id", input.userId)
    .select("*")
    .single();
  if (finalStepError || !finalStep) {
    throw new Error(finalStepError?.message || "Unable to mark final answer.");
  }

  const { data: session } = await supabase
    .from("math_work_sessions")
    .select("id")
    .eq("problem_id", input.problemId)
    .eq("user_id", input.userId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (session?.id) {
    const { error: sessionUpdateError } = await supabase
      .from("math_work_sessions")
      .update({
        status: "completed",
        completed_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", session.id);
    if (sessionUpdateError) throw new Error(sessionUpdateError.message);
  }

  const { data: problem, error: problemError } = await supabase
    .from("math_problems")
    .update({
      completed: true,
      completed_at: nowIso,
      final_answer_correct: true,
      updated_at: nowIso,
    })
    .eq("id", input.problemId)
    .eq("user_id", input.userId)
    .select("*")
    .single();
  if (problemError || !problem) {
    throw new Error(problemError?.message || "Unable to complete problem.");
  }

  if (problem.problem_set_id) {
    const { data: setProblems } = await supabase
      .from("math_problems")
      .select("completed")
      .eq("problem_set_id", String(problem.problem_set_id))
      .eq("user_id", input.userId);
    const allSetProblemsComplete =
      Array.isArray(setProblems) &&
      setProblems.length > 0 &&
      setProblems.every((entry) => Boolean(entry.completed));
    if (allSetProblemsComplete) {
      await supabase
        .from("math_problem_sets")
        .update({
          status: "completed",
          completed_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", String(problem.problem_set_id))
        .eq("user_id", input.userId);
    }
  }

  return {
    step: mapStep(finalStep as Record<string, unknown>),
    problem: mapProblem(problem as Record<string, unknown>),
    sessionId: session?.id ? String(session.id) : null,
  };
}

export async function listMathProblemSets(userId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("math_problem_sets")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return Array.isArray(data)
    ? data.map((row) => mapProblemSet(row as Record<string, unknown>))
    : [];
}

export async function createMathProblemSet(input: {
  userId: string;
  title: string;
  className?: string | null;
  assignmentPrompt?: string | null;
  problemCount?: number | null;
  sourceType?: "manual" | "paste" | "upload";
  sourceRaw?: string | null;
}) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("math_problem_sets")
    .insert({
      user_id: input.userId,
      title: input.title,
      class_name: input.className || null,
      assignment_prompt: input.assignmentPrompt || null,
      problem_count:
        input.problemCount == null ? null : Number(input.problemCount),
      source_type: input.sourceType || "manual",
      source_raw: input.sourceRaw || null,
      status: "in_progress",
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(error?.message || "Failed to create problem set.");
  }
  return mapProblemSet(data as Record<string, unknown>);
}

export async function updateMathProblemSet(
  setId: string,
  userId: string,
  updates: Record<string, unknown>
) {
  const supabase = await createSupabaseServerClient();
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if ("title" in updates) payload.title = updates.title;
  if ("class_name" in updates) payload.class_name = updates.class_name;
  if ("assignment_prompt" in updates) {
    payload.assignment_prompt = updates.assignment_prompt;
  }
  if ("problem_count" in updates) payload.problem_count = updates.problem_count;
  if ("status" in updates) payload.status = updates.status;
  if ("completed_at" in updates) payload.completed_at = updates.completed_at;

  const { data, error } = await supabase
    .from("math_problem_sets")
    .update(payload)
    .eq("id", setId)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(error?.message || "Failed to update problem set.");
  }
  return mapProblemSet(data as Record<string, unknown>);
}

export async function deleteMathProblemSet(setId: string, userId: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("math_problem_sets")
    .delete()
    .eq("id", setId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function upsertMathConceptProgress(input: {
  userId: string;
  concept: string;
  isCorrect: boolean;
}) {
  const supabase = await createSupabaseServerClient();
  const concept = input.concept || "general";
  const { data: existing } = await supabase
    .from("math_concept_progress")
    .select("id, times_encountered, times_correct, times_error")
    .eq("user_id", input.userId)
    .eq("concept", concept)
    .maybeSingle();

  const nextEncountered = Number(existing?.times_encountered || 0) + 1;
  const nextCorrect =
    Number(existing?.times_correct || 0) + (input.isCorrect ? 1 : 0);
  const nextError =
    Number(existing?.times_error || 0) + (input.isCorrect ? 0 : 1);
  const masteryLevel = Math.max(
    0,
    Math.min(100, Math.round((nextCorrect / Math.max(1, nextEncountered)) * 100))
  );

  if (existing?.id) {
    await supabase
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

  await supabase.from("math_concept_progress").insert({
    user_id: input.userId,
    concept,
    times_encountered: nextEncountered,
    times_correct: nextCorrect,
    times_error: nextError,
    mastery_level: masteryLevel,
    last_encountered: new Date().toISOString(),
  });
}

export async function getMathConceptMastery(input: {
  userId: string;
  concept: string;
}) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("math_concept_progress")
    .select("mastery_level")
    .eq("user_id", input.userId)
    .eq("concept", input.concept || "general")
    .maybeSingle();
  return Number(data?.mastery_level ?? 0);
}

export async function recordConceptStruggle(input: {
  userId: string;
  sessionId?: string | null;
  concept: string;
  workspaceContext?: string;
  subject?: string;
  interventionReason?: "auto" | "button";
}) {
  const supabase = await createSupabaseServerClient();
  const conceptTag = input.concept || "general";
  const workspaceContext = input.workspaceContext || "math";
  const subject = input.subject || "math";
  const sessionId = input.sessionId || null;
  const className = `${workspaceContext} workspace`;
  const struggleType = subject === "math" ? "reasoning_gap" : "misconception";

  const query = supabase
    .from("concept_struggles")
    .select("id, attempt_count")
    .eq("user_id", input.userId)
    .eq("concept_tag", conceptTag)
    .eq("workspace_context", workspaceContext)
    .eq("subject", subject)
    .eq("resolved", false)
    .order("detected_at", { ascending: false })
    .limit(1);

  const scopedQuery = sessionId
    ? query.eq("session_id", sessionId)
    : query.is("session_id", null);

  const { data: existing } = await scopedQuery.maybeSingle();

  if (existing?.id) {
    await supabase
      .from("concept_struggles")
      .update({
        attempt_count: Number(existing.attempt_count || 0) + 1,
        intervention_reason: input.interventionReason || "auto",
        detected_at: new Date().toISOString(),
        class_name: className,
        concept: conceptTag,
        struggle_type: struggleType,
      })
      .eq("id", existing.id);
    return;
  }

  await supabase.from("concept_struggles").insert({
    user_id: input.userId,
    session_id: sessionId,
    concept_tag: conceptTag,
    workspace_context: workspaceContext,
    subject,
    attempt_count: 1,
    victor_intervened: false,
    intervention_reason: input.interventionReason || "auto",
    class_name: className,
    concept: conceptTag,
    struggle_type: struggleType,
    detected_at: new Date().toISOString(),
    resolved: false,
  });
}

export async function countConceptStrugglesInSession(input: {
  userId: string;
  sessionId?: string | null;
  concept: string;
}) {
  if (!input.sessionId) return 0;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("concept_struggles")
    .select("attempt_count")
    .eq("user_id", input.userId)
    .eq("session_id", input.sessionId)
    .eq("concept_tag", input.concept || "general")
    .eq("resolved", false);
  if (!Array.isArray(data)) return 0;
  return data.reduce(
    (sum, row) => sum + Number((row as { attempt_count?: number }).attempt_count || 0),
    0
  );
}

export async function countOpenConceptStruggles(input: {
  userId: string;
  concept: string;
  workspaceContext?: string;
  subject?: string;
}) {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("concept_struggles")
    .select("attempt_count")
    .eq("user_id", input.userId)
    .eq("concept_tag", input.concept || "general")
    .eq("resolved", false);

  if (input.workspaceContext) {
    query = query.eq("workspace_context", input.workspaceContext);
  }
  if (input.subject) {
    query = query.eq("subject", input.subject);
  }

  const { data } = await query;
  if (!Array.isArray(data)) return 0;
  return data.reduce(
    (sum, row) => sum + Number((row as { attempt_count?: number }).attempt_count || 0),
    0
  );
}

export async function resolveConceptStruggles(input: {
  userId: string;
  concept: string;
  sessionId?: string | null;
  workspaceContext?: string;
  subject?: string;
}) {
  const supabase = await createSupabaseServerClient();
  const query = supabase
    .from("concept_struggles")
    .update({ resolved: true })
    .eq("user_id", input.userId)
    .eq("concept_tag", input.concept || "general")
    .eq("resolved", false);

  const scoped = input.sessionId
    ? query.eq("session_id", input.sessionId)
    : query;
  const workspaceScoped = input.workspaceContext
    ? scoped.eq("workspace_context", input.workspaceContext)
    : scoped;
  const subjectScoped = input.subject
    ? workspaceScoped.eq("subject", input.subject)
    : workspaceScoped;

  await subjectScoped;
}

export async function countStepCorrections(input: {
  problemId: string;
  stepId: string;
}) {
  const supabase = await createSupabaseServerClient();
  const { count } = await supabase
    .from("math_guidance")
    .select("id", { count: "exact", head: true })
    .eq("problem_id", input.problemId)
    .eq("related_step_id", input.stepId)
    .eq("guidance_type", "correction");
  return Number(count || 0);
}

export async function createMathPractice(input: {
  userId: string;
  latex: string;
  plainText?: string;
  problemType?: string;
  difficulty: "easier" | "same" | "harder";
  solutionSteps?: unknown;
}) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("math_practice")
    .insert({
      user_id: input.userId,
      latex: input.latex,
      plain_text: input.plainText || null,
      problem_type: input.problemType || null,
      difficulty: input.difficulty,
      solution_steps: input.solutionSteps || null,
      attempted: false,
      completed: false,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message || "Failed to create practice problem.");
  return mapPractice(data as Record<string, unknown>);
}
