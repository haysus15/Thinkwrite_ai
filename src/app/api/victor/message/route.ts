// src/app/api/victor/message/route.ts
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  AttemptResult,
  ScaffoldedStep,
  Subject,
  TeachingSession,
  UnderstandingProfile,
  VictorMode,
} from "@/types/academic-studio";
import {
  buildCodingSystemTail,
  buildSystemPrompt,
  detectCodingAnswerRequest,
  detectCodingHelpRequest,
  detectModeIntent,
  detectStillConfused,
  getClaudeApiKey,
  modeLabel,
  toPersistedMode,
} from "@/lib/academic/victorContextBuilder";
import { handleMathMode, readAnthropicText } from "@/lib/academic/victorModeHandler";
import { ingestStudioWriting } from "@/lib/mirror-mode/studioIngestion";
import { SOURCE_AUTHORITY } from "@/lib/mirror-mode/sourceAuthority";
import { detectSubject, shouldUseTeachingMode } from "@/lib/academic/subjectDetection";
import {
  formatHandoffForVictor,
  type VictorHandoffContext,
} from "@/lib/academic/teachingEngine";
import { buildVictorContext } from "@/lib/academic/victor/buildVictorContext";
import { validateVictorContext } from "@/lib/academic/victor/validateVictorContext";
import {
  buildMisconceptionInstruction,
  detectMisconception,
} from "@/lib/academic/victor/detectMisconception";
import {
  getCoachingProfileBlock,
  type CoachingProfile,
} from "@/lib/academic/victor/coachingProfiles";
import type {
  MisconceptionLevel,
  VictorContext,
} from "@/lib/academic/victor/victorTypes";

export const runtime = "nodejs";

type VictorMirrorCapture = {
  captured: boolean;
  chamber: "academic";
  wordCount: number;
};

type TeachingResponseType = "step" | "feedback" | "complete" | "conversation";
type TeachingNextAction = "advance" | "probe" | "reteach" | "reframe";

type VictorApiRequest = {
  message?: string;
  conversationId?: string;
  sessionId?: string;
  teachingSession?: TeachingSession | null;
  mode?: VictorMode | "conversation";
  intensity?: number;
  workspaceContext?: string;
  mathTriggerReason?: MathTriggerReason;
  victorHandoffContext?: VictorHandoffContext | null;
  victorContext?: Partial<VictorContext> | null;
  coachingProfile?: CoachingProfile;
  assignmentId?: string | null;
};

type TeachingStepPayload = {
  type: "step";
  stepNumber: number;
  title: string;
  instruction: string;
  gap: string | null;
  totalSteps: number;
};

type TeachingFeedbackPayload = {
  type: "feedback";
  attemptResult: AttemptResult;
  feedback: string;
  nextAction: TeachingNextAction;
  reteachConcept: string | null;
};

type TeachingCompletePayload = {
  type: "complete";
  summary: string;
  strongConcepts: string[];
  gapConcepts: string[];
  misconceptions: string[];
};

type TeachingPayload =
  | TeachingStepPayload
  | TeachingFeedbackPayload
  | TeachingCompletePayload;

type VictorHistoryItem = {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

const DEFAULT_MIRROR_CAPTURE: VictorMirrorCapture = {
  captured: false,
  chamber: "academic",
  wordCount: 0,
};

type MathTriggerReason =
  | "repeated_error"
  | "low_mastery"
  | "session_struggle"
  | "session_complete_errors"
  | "manual_request";

function parseMathTriggerReason(
  explicitReason?: unknown,
  workspaceContext?: string
): MathTriggerReason | null {
  if (
    explicitReason === "repeated_error" ||
    explicitReason === "low_mastery" ||
    explicitReason === "session_struggle" ||
    explicitReason === "session_complete_errors" ||
    explicitReason === "manual_request"
  ) {
    return explicitReason;
  }
  if (!workspaceContext) return null;
  const text = workspaceContext.toLowerCase();
  if (!text.includes("math mode")) return null;
  if (text.includes("trigger: repeated_error")) return "repeated_error";
  if (text.includes("trigger: low_mastery")) return "low_mastery";
  if (text.includes("trigger: session_struggle")) return "session_struggle";
  if (text.includes("trigger: session_complete_errors")) return "session_complete_errors";
  if (text.includes("manual request")) return "manual_request";
  return null;
}

function mathTriggerOpening(reason: MathTriggerReason): string {
  switch (reason) {
    case "repeated_error":
      return "I noticed this step has been incorrect a few times. Let's isolate the exact operation causing the error.";
    case "low_mastery":
      return "I see this concept is still unstable. Let's do a quick foundation check before the next step.";
    case "session_struggle":
      return "I am seeing a pattern on this concept. Let's address the core rule directly.";
    case "session_complete_errors":
      return "I noticed a few errors across the full solution. Let's review the highest-impact one first.";
    case "manual_request":
      return "Let's work this step together from your current line.";
    default:
      return "Let's focus on this exact step.";
  }
}

function enforceMathTriggerReasonReply(
  reply: string,
  workspaceContext?: string,
  explicitReason?: unknown
): string {
  const reason = parseMathTriggerReason(explicitReason, workspaceContext);
  if (!reason) return reply;
  if (reason === "manual_request") return reply;
  const opening = mathTriggerOpening(reason);
  const normalized = reply.trim().toLowerCase();
  if (
    normalized.startsWith("i noticed") ||
    normalized.startsWith("i see") ||
    normalized.startsWith("let's")
  ) {
    return reply;
  }
  return `${opening}\n\n${reply}`;
}

function enforceSourceGuidanceSafety(
  reply: string,
  workspaceContext?: string
): string {
  const isSourceGuidance = (workspaceContext || "")
    .toLowerCase()
    .includes("source guidance");
  if (!isSourceGuidance) return reply;

  const citationLikePattern =
    /\b[A-Z][a-z]+,\s*[A-Z]\.\s*\(\d{4}\)|https?:\/\/|doi:|journal|vol\.\s*\d+/i;
  if (!citationLikePattern.test(reply)) {
    return reply;
  }

  return "Focus on source types, not specific titles. Use Google Scholar and your library databases with section-specific terms, required date ranges, and method keywords. Match each source to one claim in your section and record why it supports that claim.";
}

function createEmptyProfile(): UnderstandingProfile {
  return {
    strongConcepts: [],
    gapConcepts: [],
    misconceptions: [],
    retriedSteps: [],
  };
}

function sanitizeVictorContext(input?: Partial<VictorContext> | null): VictorContext {
  return {
    sectionTitle: typeof input?.sectionTitle === "string" ? input.sectionTitle : "",
    sectionBody:
      typeof input?.sectionBody === "string" ? input.sectionBody : null,
    assignmentRequirements:
      input?.assignmentRequirements &&
      typeof input.assignmentRequirements === "object"
        ? (input.assignmentRequirements as Record<string, unknown>)
        : null,
    assignmentName:
      typeof input?.assignmentName === "string" ? input.assignmentName : "",
    className: typeof input?.className === "string" ? input.className : "",
    paperType: typeof input?.paperType === "string" ? input.paperType : null,
    studentDeclaration:
      input?.studentDeclaration && typeof input.studentDeclaration === "object"
        ? {
            argument:
              typeof input.studentDeclaration.argument === "string"
                ? input.studentDeclaration.argument
                : undefined,
            main_points:
              typeof input.studentDeclaration.main_points === "string"
                ? input.studentDeclaration.main_points
                : undefined,
            assignment_understanding:
              typeof input.studentDeclaration.assignment_understanding === "string"
                ? input.studentDeclaration.assignment_understanding
                : undefined,
          }
        : null,
    unsureSections: Array.isArray(input?.unsureSections)
      ? input.unsureSections
          .map((item) => (typeof item === "string" ? item.trim() : ""))
          .filter(Boolean)
      : [],
    knownStruggles: Array.isArray(input?.knownStruggles)
      ? input.knownStruggles
          .map((item) => {
            if (!item || typeof item !== "object") return null;
            const value = item as Record<string, unknown>;
            if (
              typeof value.concept !== "string" ||
              typeof value.detectedAt !== "string"
            ) {
              return null;
            }
            return { concept: value.concept, detectedAt: value.detectedAt };
          })
          .filter(
            (item): item is { concept: string; detectedAt: string } => Boolean(item)
          )
      : [],
  };
}

function sanitizeCoachingProfile(input?: unknown): CoachingProfile {
  if (
    input === "tutor" ||
    input === "critic" ||
    input === "exam_prep" ||
    input === "fast_review"
  ) {
    return input;
  }
  return "tutor";
}

function buildVictorSystemPrefix(input: {
  contextBlock: string;
  coachingProfile: CoachingProfile;
  coachingProfileBlock: string;
  handoffInjection?: string;
  misconceptionInstruction: string;
  warningMessages: string[];
}): string {
  const sections = [
    "STUDENT CONTEXT ANCHORS:",
    input.contextBlock,
    input.coachingProfileBlock,
    `COACHING_PROFILE: ${input.coachingProfile}`,
  ];

  if (input.misconceptionInstruction) {
    sections.push(`MISCONCEPTION INSTRUCTION: ${input.misconceptionInstruction}`);
  }

  if (input.warningMessages.length > 0) {
    sections.push("CONTEXT WARNINGS:");
    sections.push(input.warningMessages.map((item) => `- ${item}`).join("\n"));
  }

  if (input.handoffInjection) {
    sections.push(input.handoffInjection);
  }

  return sections.join("\n\n");
}

function uniquePush(list: string[], value: string | null | undefined): string[] {
  const normalized = (value || "").trim();
  if (!normalized || list.includes(normalized)) return list;
  return [...list, normalized];
}

function parseJsonBlock(text: string): unknown {
  const trimmed = text.trim();
  const stripped = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim()
    : trimmed;
  return JSON.parse(stripped);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function toAttemptResult(value: unknown): AttemptResult {
  if (
    value === "correct" ||
    value === "partial" ||
    value === "misconception" ||
    value === "unattempted"
  ) {
    return value;
  }
  return "unattempted";
}

function coerceStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "").trim()).filter(Boolean);
}

function normalizeStepPayload(value: unknown, fallbackStepNumber = 1): TeachingStepPayload {
  if (!isObject(value)) {
    return {
      type: "step",
      stepNumber: fallbackStepNumber,
      title: `Step ${fallbackStepNumber}`,
      instruction: "Start by restating the problem in your own words.",
      gap: fallbackStepNumber === 1 ? null : "What should happen in this step?",
      totalSteps: 4,
    };
  }

  const stepNumberRaw = Number(value.stepNumber);
  const stepNumber = Number.isFinite(stepNumberRaw) ? Math.max(1, Math.floor(stepNumberRaw)) : fallbackStepNumber;
  const totalStepsRaw = Number(value.totalSteps);
  const totalSteps = Number.isFinite(totalStepsRaw)
    ? Math.min(6, Math.max(3, Math.floor(totalStepsRaw)))
    : 4;

  return {
    type: "step",
    stepNumber,
    title:
      typeof value.title === "string" && value.title.trim()
        ? value.title.trim()
        : `Step ${stepNumber}`,
    instruction:
      typeof value.instruction === "string" && value.instruction.trim()
        ? value.instruction.trim()
        : "Work through this step carefully.",
    gap:
      stepNumber === 1
        ? null
        : typeof value.gap === "string" && value.gap.trim()
          ? value.gap.trim()
          : "What should the missing part be?",
    totalSteps,
  };
}

function normalizeFeedbackPayload(value: unknown): TeachingFeedbackPayload {
  if (!isObject(value)) {
    return {
      type: "feedback",
      attemptResult: "unattempted",
      feedback: "Your attempt is incomplete. Start by addressing the current gap directly.",
      nextAction: "reframe",
      reteachConcept: null,
    };
  }

  const nextActionRaw = value.nextAction;
  const nextAction: TeachingNextAction =
    nextActionRaw === "advance" ||
    nextActionRaw === "probe" ||
    nextActionRaw === "reteach" ||
    nextActionRaw === "reframe"
      ? nextActionRaw
      : "reframe";

  return {
    type: "feedback",
    attemptResult: toAttemptResult(value.attemptResult),
    feedback:
      typeof value.feedback === "string" && value.feedback.trim()
        ? value.feedback.trim()
        : "Address the exact gap before moving forward.",
    nextAction,
    reteachConcept:
      typeof value.reteachConcept === "string" && value.reteachConcept.trim()
        ? value.reteachConcept.trim()
        : null,
  };
}

function normalizeCompletePayload(value: unknown, profile: UnderstandingProfile): TeachingCompletePayload {
  if (!isObject(value)) {
    return {
      type: "complete",
      summary: "Problem complete. You moved through each step and corrected the key gaps.",
      strongConcepts: profile.strongConcepts,
      gapConcepts: profile.gapConcepts,
      misconceptions: profile.misconceptions,
    };
  }

  return {
    type: "complete",
    summary:
      typeof value.summary === "string" && value.summary.trim()
        ? value.summary.trim()
        : "Problem complete.",
    strongConcepts: coerceStringArray(value.strongConcepts),
    gapConcepts: coerceStringArray(value.gapConcepts),
    misconceptions: coerceStringArray(value.misconceptions),
  };
}

function toScaffoldedStep(step: TeachingStepPayload): ScaffoldedStep {
  return {
    stepNumber: step.stepNumber,
    title: step.title,
    instruction: step.instruction,
    gap: step.gap,
    revealed: true,
    studentAttempt: null,
    attemptResult: null,
    victorFeedback: null,
    subSteps: [],
  };
}

function createPlaceholderStep(stepNumber: number): ScaffoldedStep {
  return {
    stepNumber,
    title: `Step ${stepNumber}`,
    instruction: "",
    gap: stepNumber === 1 ? null : "",
    revealed: false,
    studentAttempt: null,
    attemptResult: null,
    victorFeedback: null,
    subSteps: [],
  };
}

function mergeStepAtIndex(steps: ScaffoldedStep[], index: number, step: ScaffoldedStep): ScaffoldedStep[] {
  const next = [...steps];
  if (!next[index]) {
    next[index] = step;
    return next;
  }
  next[index] = { ...next[index], ...step, revealed: true };
  return next;
}

function buildStepReply(step: ScaffoldedStep, totalSteps: number): string {
  const gapLine = step.gap ? `\n\nGap: ${step.gap}` : "";
  return `Step ${step.stepNumber} of ${totalSteps}: ${step.title}\n\n${step.instruction}${gapLine}`;
}

function parseTeachingPayload(rawText: string): TeachingPayload | null {
  try {
    const parsed = parseJsonBlock(rawText);
    if (!isObject(parsed) || typeof parsed.type !== "string") return null;

    if (parsed.type === "step") {
      return normalizeStepPayload(parsed);
    }
    if (parsed.type === "feedback") {
      return normalizeFeedbackPayload(parsed);
    }
    if (parsed.type === "complete") {
      return normalizeCompletePayload(parsed, createEmptyProfile());
    }
    return null;
  } catch {
    return null;
  }
}

function toTeachingSession(row: {
  id: string;
  subject: string;
  problem_statement: string;
  steps: unknown;
  current_step_index: number;
  understanding_profile: unknown;
  completed_at: string | null;
}): TeachingSession {
  const rawSteps = Array.isArray(row.steps) ? row.steps : [];
  const steps: ScaffoldedStep[] = rawSteps
    .map((step) => {
      if (!isObject(step)) return null;
      const stepNumber = Number(step.stepNumber);
      if (!Number.isFinite(stepNumber)) return null;
      return {
        stepNumber,
        title: String(step.title || `Step ${stepNumber}`),
        instruction: String(step.instruction || ""),
        gap: step.gap == null ? null : String(step.gap),
        revealed: Boolean(step.revealed),
        studentAttempt: step.studentAttempt == null ? null : String(step.studentAttempt),
        attemptResult: step.attemptResult == null ? null : toAttemptResult(step.attemptResult),
        victorFeedback: step.victorFeedback == null ? null : String(step.victorFeedback),
        subSteps: Array.isArray(step.subSteps)
          ? step.subSteps
              .map((sub) => {
                if (!isObject(sub)) return null;
                const subNum = Number(sub.stepNumber);
                if (!Number.isFinite(subNum)) return null;
                return {
                  stepNumber: subNum,
                  title: String(sub.title || `Step ${subNum}`),
                  instruction: String(sub.instruction || ""),
                  gap: sub.gap == null ? null : String(sub.gap),
                  revealed: Boolean(sub.revealed),
                  studentAttempt:
                    sub.studentAttempt == null ? null : String(sub.studentAttempt),
                  attemptResult:
                    sub.attemptResult == null ? null : toAttemptResult(sub.attemptResult),
                  victorFeedback:
                    sub.victorFeedback == null ? null : String(sub.victorFeedback),
                  subSteps: [],
                } as ScaffoldedStep;
              })
              .filter((sub): sub is ScaffoldedStep => Boolean(sub))
          : [],
      } as ScaffoldedStep;
    })
    .filter((step): step is ScaffoldedStep => Boolean(step));

  const profile = isObject(row.understanding_profile)
    ? {
        strongConcepts: coerceStringArray(row.understanding_profile.strongConcepts),
        gapConcepts: coerceStringArray(row.understanding_profile.gapConcepts),
        misconceptions: coerceStringArray(row.understanding_profile.misconceptions),
        retriedSteps: Array.isArray(row.understanding_profile.retriedSteps)
          ? row.understanding_profile.retriedSteps
              .map((value) => Number(value))
              .filter((value): value is number => Number.isFinite(value))
          : [],
      }
    : createEmptyProfile();

  return {
    sessionId: row.id,
    subject:
      row.subject === "math" ||
      row.subject === "science" ||
      row.subject === "writing" ||
      row.subject === "history" ||
      row.subject === "computer-science" ||
      row.subject === "general"
        ? row.subject
        : "general",
    problemStatement: row.problem_statement,
    steps,
    currentStepIndex: Number.isFinite(row.current_step_index)
      ? row.current_step_index
      : 0,
    completedAt: row.completed_at,
    understandingProfile: profile,
    plannedStepCount: steps.length,
  };
}

async function saveTeachingSession(input: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
  session: TeachingSession;
}): Promise<TeachingSession> {
  const { supabase, userId, session } = input;

  if (session.sessionId) {
    const { data, error } = await supabase
      .from("teaching_sessions")
      .update({
        subject: session.subject,
        problem_statement: session.problemStatement,
        steps: session.steps,
        current_step_index: session.currentStepIndex,
        understanding_profile: session.understandingProfile,
        completed_at: session.completedAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", session.sessionId)
      .eq("user_id", userId)
      .select(
        "id, subject, problem_statement, steps, current_step_index, understanding_profile, completed_at"
      )
      .single();

    if (!error && data) return toTeachingSession(data);
  }

  const { data, error } = await supabase
    .from("teaching_sessions")
    .insert({
      user_id: userId,
      subject: session.subject,
      problem_statement: session.problemStatement,
      steps: session.steps,
      current_step_index: session.currentStepIndex,
      understanding_profile: session.understandingProfile,
      completed_at: session.completedAt,
    })
    .select(
      "id, subject, problem_statement, steps, current_step_index, understanding_profile, completed_at"
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to persist teaching session.");
  }

  return toTeachingSession(data);
}

async function loadTeachingSession(input: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
  sessionId: string;
}): Promise<TeachingSession | null> {
  const { supabase, userId, sessionId } = input;
  const { data, error } = await supabase
    .from("teaching_sessions")
    .select(
      "id, subject, problem_statement, steps, current_step_index, understanding_profile, completed_at"
    )
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return toTeachingSession(data);
}

async function createTeachingStep(input: {
  anthropic: Anthropic;
  subject: Subject;
  problemStatement: string;
  existingSession: TeachingSession | null;
  nextStepNumber: number;
  systemPrefix?: string;
}): Promise<TeachingStepPayload> {
  const {
    anthropic,
    subject,
    problemStatement,
    existingSession,
    nextStepNumber,
    systemPrefix,
  } = input;
  const sessionSummary = existingSession
    ? JSON.stringify(
        {
          subject: existingSession.subject,
          currentStepIndex: existingSession.currentStepIndex,
          steps: existingSession.steps,
          understandingProfile: existingSession.understandingProfile,
        },
        null,
        2
      )
    : "null";

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1200,
    temperature: 0.2,
    system: `${systemPrefix ? `${systemPrefix}\n\n` : ""}${buildSystemPrompt("teaching", 3)}`,
    messages: [
      {
        role: "user",
        content: `Subject: ${subject}\nProblem: ${problemStatement}\nCurrentSession: ${sessionSummary}\nGenerate type=step for stepNumber=${nextStepNumber}. For stepNumber=1, gap must be null. For stepNumber>1, include a concrete gap question. Return JSON only.`,
      },
    ],
  });

  return normalizeStepPayload(parseTeachingPayload(readAnthropicText(response)) || null, nextStepNumber);
}

async function evaluateTeachingAttempt(input: {
  anthropic: Anthropic;
  session: TeachingSession;
  step: ScaffoldedStep;
  attempt: string;
  systemPrefix?: string;
}): Promise<TeachingFeedbackPayload> {
  const { anthropic, session, step, attempt, systemPrefix } = input;
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 800,
    temperature: 0.2,
    system: `${systemPrefix ? `${systemPrefix}\n\n` : ""}${buildSystemPrompt("teaching", 3)}`,
    messages: [
      {
        role: "user",
        content: `Problem: ${session.problemStatement}\nSubject: ${session.subject}\nCurrentStep: ${JSON.stringify(step, null, 2)}\nStudentAttempt: ${attempt}\nReturn type=feedback JSON only.`,
      },
    ],
  });

  return normalizeFeedbackPayload(parseTeachingPayload(readAnthropicText(response)) || null);
}

async function createTeachingCompletion(input: {
  anthropic: Anthropic;
  session: TeachingSession;
  systemPrefix?: string;
}): Promise<TeachingCompletePayload> {
  const { anthropic, session, systemPrefix } = input;
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 800,
    temperature: 0.2,
    system: `${systemPrefix ? `${systemPrefix}\n\n` : ""}${buildSystemPrompt("teaching", 3)}`,
    messages: [
      {
        role: "user",
        content: `Problem: ${session.problemStatement}\nSubject: ${session.subject}\nSteps: ${JSON.stringify(
          session.steps,
          null,
          2
        )}\nProfile: ${JSON.stringify(session.understandingProfile, null, 2)}\nReturn type=complete JSON only.`,
      },
    ],
  });

  return normalizeCompletePayload(
    parseTeachingPayload(readAnthropicText(response)) || null,
    session.understandingProfile
  );
}

async function captureVictorMessageForMirror(input: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
  text: string;
  sessionId: string;
  mode: VictorMode;
  workspaceContext: string;
}): Promise<VictorMirrorCapture> {
  const { supabase, userId, text, sessionId, mode, workspaceContext } = input;
  if (!text.trim()) return DEFAULT_MIRROR_CAPTURE;

  try {
    const captureResult = await ingestStudioWriting({
      supabase,
      userId,
      sourceStudio: "academic",
      sourceAuthority: SOURCE_AUTHORITY.USER_TYPED,
      text,
      sessionId,
      context: workspaceContext || `victor_${mode}`,
      writingType: "academic",
      registerInArchive: false,
    });

    return {
      captured: Boolean(captureResult.captured),
      chamber: "academic",
      wordCount: captureResult.captured ? captureResult.wordCount : 0,
    };
  } catch (captureError) {
    console.warn("Victor mirror capture skipped:", captureError);
    return DEFAULT_MIRROR_CAPTURE;
  }
}

export async function POST(request: NextRequest) {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const body = (await request.json()) as VictorApiRequest;
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json(
      { success: false, error: "Message is required." },
      { status: 400 }
    );
  }

  const rawMode = body?.mode;
  const requestedMode: VictorMode =
    rawMode === "default" ||
    rawMode === "idea_expansion" ||
    rawMode === "challenge" ||
    rawMode === "study" ||
    rawMode === "math" ||
    rawMode === "coding_review" ||
    rawMode === "teaching"
      ? rawMode
      : "default";

  const explicitConversationMode = rawMode === "conversation";
  const explicitTeachingMode = requestedMode === "teaching";
  const autoTeachingMode =
    !explicitConversationMode &&
    !["math", "coding_review", "study", "challenge", "idea_expansion"].includes(
      requestedMode
    ) &&
    shouldUseTeachingMode(message);
  const useTeachingMode = explicitTeachingMode || autoTeachingMode;
  const effectiveMode: VictorMode = useTeachingMode ? "teaching" : requestedMode;
  const persistedMode = toPersistedMode(effectiveMode);
  const suggestedMode = useTeachingMode ? null : detectModeIntent(message);

  const apiKey = getClaudeApiKey();
  if (!apiKey) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Missing API key. Add CLAUDE_API_KEY to .env.local and restart next dev.",
      },
      { status: 500 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const conversationId = body?.conversationId as string | undefined;
  let conversationData: { id: string; messages: VictorHistoryItem[] } | null = null;

  if (conversationId) {
    const { data, error: fetchError } = await supabase
      .from("victor_conversations")
      .select("id, messages")
      .eq("id", conversationId)
      .eq("user_id", userId)
      .single();

    if (fetchError || !data) {
      return NextResponse.json(
        { success: false, error: "Conversation not found." },
        { status: 404 }
      );
    }

    conversationData = data as typeof conversationData;
  }

  if (!conversationId) {
    const { data, error: insertError } = await supabase
      .from("victor_conversations")
      .insert({
        user_id: userId,
        mode: persistedMode,
        messages: [],
        saved: false,
        last_message_at: new Date().toISOString(),
      })
      .select("id, messages")
      .single();

    if (insertError || !data) {
      return NextResponse.json(
        { success: false, error: insertError?.message || "Save failed." },
        { status: 500 }
      );
    }

    conversationData = data as typeof conversationData;
  }

  if (!conversationData) {
    return NextResponse.json(
      { success: false, error: "Conversation not initialized." },
      { status: 500 }
    );
  }

  const currentId = conversationData.id;
  const history = (conversationData.messages || []) as VictorHistoryItem[];
  const workspaceContext =
    typeof body?.workspaceContext === "string" ? body.workspaceContext.trim() : "";
  const handoffInjection =
    body?.victorHandoffContext &&
    typeof body.victorHandoffContext === "object"
      ? formatHandoffForVictor(body.victorHandoffContext)
      : "";
  const victorContext = sanitizeVictorContext(body?.victorContext);
  const assignmentId =
    typeof body?.assignmentId === "string" && body.assignmentId
      ? body.assignmentId
      : null;
  let coachingProfile = sanitizeCoachingProfile(body?.coachingProfile);
  if (assignmentId && !body?.coachingProfile) {
    const { data: assignmentProfileRow } = await supabase
      .from("assignments")
      .select("victor_coaching_profile")
      .eq("id", assignmentId)
      .eq("user_id", userId)
      .maybeSingle();
    coachingProfile = sanitizeCoachingProfile(
      assignmentProfileRow?.victor_coaching_profile
    );
  }
  if (victorContext.className.trim()) {
    const { data: unresolved } = await supabase
      .from("concept_struggles")
      .select("concept, detected_at")
      .eq("user_id", userId)
      .eq("class_name", victorContext.className.trim())
      .eq("resolved", false)
      .order("detected_at", { ascending: false })
      .limit(5);
    if (Array.isArray(unresolved) && unresolved.length > 0) {
      victorContext.knownStruggles = unresolved
        .filter(
          (row): row is { concept: string; detected_at: string } =>
            !!row &&
            typeof row.concept === "string" &&
            typeof row.detected_at === "string"
        )
        .map((row) => ({
          concept: row.concept,
          detectedAt: row.detected_at.slice(0, 10),
        }));
    }
  }
  const isPaperContext =
    workspaceContext.toLowerCase().includes("paper") ||
    body?.victorHandoffContext?.workspaceContext === "paper";
  const contextValidation = isPaperContext
    ? validateVictorContext(victorContext)
    : {
        isValid: true,
        missingFields: [],
        recoveryMessage: null,
        warningMessages: [] as string[],
      };
  const misconceptionLevel = await detectMisconception(message);
  const misconceptionInstruction = buildMisconceptionInstruction(
    misconceptionLevel,
    coachingProfile
  );
  const coachingProfileBlock = getCoachingProfileBlock(coachingProfile);
  const contextBlock = buildVictorContext(victorContext);
  const victorSystemPrefix = buildVictorSystemPrefix({
    contextBlock,
    coachingProfile,
    coachingProfileBlock,
    handoffInjection,
    misconceptionInstruction,
    warningMessages: contextValidation.warningMessages,
  });

  if (!contextValidation.isValid) {
    return NextResponse.json(
      {
        success: true,
        conversationId: currentId,
        responseType: "conversation" as TeachingResponseType,
        recoveryMessage: contextValidation.recoveryMessage,
        missingFields: contextValidation.missingFields,
      },
      { status: 200 }
    );
  }

  if (effectiveMode === "math") {
    const anthropic = new Anthropic({ apiKey });
    const result = await handleMathMode({
      anthropic,
      supabase,
      currentId,
      userId,
      message,
      history,
      persistedMode,
      systemPrefix: victorSystemPrefix,
    });

    const mirrorCapture = await captureVictorMessageForMirror({
      supabase,
      userId,
      text: message,
      sessionId: currentId,
      mode: effectiveMode,
      workspaceContext,
    });

    return NextResponse.json(
      {
        success: true,
        ...result,
        responseType: "conversation" as TeachingResponseType,
        misconceptionLevel,
        mirrorCapture,
      },
      { status: 200 }
    );
  }

  const updatedHistory = [
    ...history,
    { role: "user" as const, content: message, timestamp: new Date().toISOString() },
  ];

  if (!useTeachingMode && suggestedMode && suggestedMode !== effectiveMode) {
    const reply = `This sounds like we should switch to ${modeLabel(
      suggestedMode
    )} Mode. Want me to switch?`;

    const nextHistory = [
      ...updatedHistory,
      { role: "assistant" as const, content: reply, timestamp: new Date().toISOString() },
    ];

    await supabase
      .from("victor_conversations")
      .update({
        messages: nextHistory,
        last_message_at: new Date().toISOString(),
        mode: persistedMode,
      })
      .eq("id", currentId)
      .eq("user_id", userId);

    const mirrorCapture = await captureVictorMessageForMirror({
      supabase,
      userId,
      text: message,
      sessionId: currentId,
      mode: effectiveMode,
      workspaceContext,
    });

    return NextResponse.json(
      {
        success: true,
        conversationId: currentId,
        reply,
        suggestedMode,
        requiresConfirmation: true,
        responseType: "conversation" as TeachingResponseType,
        misconceptionLevel,
        mirrorCapture,
      },
      { status: 200 }
    );
  }

  if (useTeachingMode) {
    const anthropic = new Anthropic({ apiKey });

    let session: TeachingSession | null = body.teachingSession || null;
    const requestedSessionId =
      typeof body.sessionId === "string"
        ? body.sessionId
        : typeof body.teachingSession?.sessionId === "string"
          ? body.teachingSession.sessionId
          : "";

    if (!session && requestedSessionId) {
      session = await loadTeachingSession({
        supabase,
        userId,
        sessionId: requestedSessionId,
      });
    }

    if (session?.completedAt) {
      session = null;
    }

    let responseType: TeachingResponseType = "conversation";
    let reply = "";
    let stepForResponse: ScaffoldedStep | undefined;
    let feedbackForResponse:
      | {
          attemptResult: AttemptResult;
          nextAction: string;
          reteachConcept: string | null;
        }
      | undefined;
    let profileForResponse: UnderstandingProfile | undefined;

    if (!session) {
      const subject = detectSubject(message);
      const firstStepPayload = await createTeachingStep({
        anthropic,
        subject,
        problemStatement: message,
        existingSession: null,
        nextStepNumber: 1,
        systemPrefix: victorSystemPrefix,
      });
      const totalSteps = firstStepPayload.totalSteps;
      const firstStep = toScaffoldedStep({ ...firstStepPayload, gap: null });
      const allSteps: ScaffoldedStep[] = Array.from({ length: totalSteps }, (_, index) =>
        index === 0 ? firstStep : createPlaceholderStep(index + 1)
      );

      session = {
        sessionId: "",
        subject,
        problemStatement: message,
        steps: allSteps,
        currentStepIndex: 0,
        completedAt: null,
        understandingProfile: createEmptyProfile(),
        plannedStepCount: totalSteps,
      };

      responseType = "step";
      reply = buildStepReply(firstStep, totalSteps);
      stepForResponse = firstStep;
    } else {
      const totalSteps = session.plannedStepCount || Math.max(3, session.steps.length || 3);
      const currentIndex = Math.max(0, Math.min(session.currentStepIndex, totalSteps - 1));
      const currentStep = session.steps[currentIndex] || createPlaceholderStep(currentIndex + 1);
      const needsAttemptFeedback = Boolean(currentStep.gap);

      if (!needsAttemptFeedback) {
        if (currentIndex >= totalSteps - 1) {
          const completePayload = await createTeachingCompletion({
            anthropic,
            session,
            systemPrefix: victorSystemPrefix,
          });
          session.completedAt = new Date().toISOString();
          session.understandingProfile = {
            ...session.understandingProfile,
            strongConcepts:
              completePayload.strongConcepts.length > 0
                ? completePayload.strongConcepts
                : session.understandingProfile.strongConcepts,
            gapConcepts:
              completePayload.gapConcepts.length > 0
                ? completePayload.gapConcepts
                : session.understandingProfile.gapConcepts,
            misconceptions:
              completePayload.misconceptions.length > 0
                ? completePayload.misconceptions
                : session.understandingProfile.misconceptions,
          };

          responseType = "complete";
          reply = completePayload.summary;
          profileForResponse = session.understandingProfile;
        } else {
          const nextStepNumber = currentIndex + 2;
          const nextStepPayload = await createTeachingStep({
            anthropic,
            subject: session.subject,
            problemStatement: session.problemStatement,
            existingSession: session,
            nextStepNumber,
            systemPrefix: victorSystemPrefix,
          });
          const nextStep = toScaffoldedStep(nextStepPayload);
          session.steps = mergeStepAtIndex(session.steps, nextStepNumber - 1, nextStep);
          session.currentStepIndex = nextStepNumber - 1;
          session.plannedStepCount = Math.max(totalSteps, nextStepPayload.totalSteps);

          responseType = "step";
          reply = buildStepReply(nextStep, session.plannedStepCount);
          stepForResponse = nextStep;
        }
      } else {
        const feedbackPayload = await evaluateTeachingAttempt({
          anthropic,
          session,
          step: currentStep,
          attempt: message,
          systemPrefix: victorSystemPrefix,
        });

        const updatedCurrent: ScaffoldedStep = {
          ...currentStep,
          revealed: true,
          studentAttempt: message,
          attemptResult: feedbackPayload.attemptResult,
          victorFeedback: feedbackPayload.feedback,
          subSteps:
            feedbackPayload.nextAction === "reteach"
              ? [
                  ...currentStep.subSteps,
                  {
                    stepNumber: currentStep.stepNumber,
                    title: `Reteach: ${feedbackPayload.reteachConcept || currentStep.title}`,
                    instruction: feedbackPayload.feedback,
                    gap: currentStep.gap,
                    revealed: true,
                    studentAttempt: null,
                    attemptResult: null,
                    victorFeedback: null,
                    subSteps: [],
                  },
                ]
              : currentStep.subSteps,
        };

        session.steps = mergeStepAtIndex(session.steps, currentIndex, updatedCurrent);

        if (feedbackPayload.attemptResult === "correct") {
          session.understandingProfile.strongConcepts = uniquePush(
            session.understandingProfile.strongConcepts,
            currentStep.title
          );
        } else if (feedbackPayload.attemptResult === "partial") {
          session.understandingProfile.gapConcepts = uniquePush(
            session.understandingProfile.gapConcepts,
            currentStep.title
          );
        } else if (feedbackPayload.attemptResult === "misconception") {
          session.understandingProfile.misconceptions = uniquePush(
            session.understandingProfile.misconceptions,
            feedbackPayload.reteachConcept || currentStep.title
          );
          if (!session.understandingProfile.retriedSteps.includes(currentStep.stepNumber)) {
            session.understandingProfile.retriedSteps = [
              ...session.understandingProfile.retriedSteps,
              currentStep.stepNumber,
            ];
          }
        }

        if (feedbackPayload.nextAction === "advance") {
          if (currentIndex >= totalSteps - 1) {
            const completePayload = await createTeachingCompletion({
              anthropic,
              session,
              systemPrefix: victorSystemPrefix,
            });
            session.completedAt = new Date().toISOString();
            session.understandingProfile = {
              ...session.understandingProfile,
              strongConcepts:
                completePayload.strongConcepts.length > 0
                  ? completePayload.strongConcepts
                  : session.understandingProfile.strongConcepts,
              gapConcepts:
                completePayload.gapConcepts.length > 0
                  ? completePayload.gapConcepts
                  : session.understandingProfile.gapConcepts,
              misconceptions:
                completePayload.misconceptions.length > 0
                  ? completePayload.misconceptions
                  : session.understandingProfile.misconceptions,
            };

            responseType = "complete";
            reply = completePayload.summary;
            profileForResponse = session.understandingProfile;
          } else {
            const nextStepNumber = currentIndex + 2;
            const nextStepPayload = await createTeachingStep({
              anthropic,
              subject: session.subject,
              problemStatement: session.problemStatement,
              existingSession: session,
              nextStepNumber,
              systemPrefix: victorSystemPrefix,
            });
            const nextStep = toScaffoldedStep(nextStepPayload);
            session.steps = mergeStepAtIndex(session.steps, nextStepNumber - 1, nextStep);
            session.currentStepIndex = nextStepNumber - 1;
            session.plannedStepCount = Math.max(totalSteps, nextStepPayload.totalSteps);

            responseType = "step";
            reply = buildStepReply(nextStep, session.plannedStepCount);
            stepForResponse = nextStep;
          }
        } else {
          responseType = "feedback";
          reply = feedbackPayload.feedback;
          feedbackForResponse = {
            attemptResult: feedbackPayload.attemptResult,
            nextAction: feedbackPayload.nextAction,
            reteachConcept: feedbackPayload.reteachConcept,
          };
        }
      }
    }

    session = await saveTeachingSession({
      supabase,
      userId,
      session,
    });

    reply = enforceMathTriggerReasonReply(
      reply,
      workspaceContext,
      body?.mathTriggerReason
    );

    const finalHistory = [
      ...updatedHistory,
      {
        role: "assistant" as const,
        content: reply,
        timestamp: new Date().toISOString(),
      },
    ];

    await supabase
      .from("victor_conversations")
      .update({
        messages: finalHistory,
        last_message_at: new Date().toISOString(),
        mode: toPersistedMode("teaching"),
      })
      .eq("id", currentId)
      .eq("user_id", userId);

    const mirrorCapture = await captureVictorMessageForMirror({
      supabase,
      userId,
      text: message,
      sessionId: currentId,
      mode: "teaching",
      workspaceContext,
    });

    return NextResponse.json(
      {
        success: true,
        conversationId: currentId,
        reply,
        responseType,
        step: stepForResponse,
        feedback: feedbackForResponse,
        updatedSession: session,
        understandingProfile: profileForResponse,
        misconceptionLevel,
        suggestedMode: null,
        requiresConfirmation: false,
        mirrorCapture,
      },
      { status: 200 }
    );
  }

  const intensity = typeof body?.intensity === "number" ? body.intensity : 3;
  const codingNeedsAnswer =
    effectiveMode === "coding_review" &&
    (detectCodingAnswerRequest(message) ||
      detectStillConfused(message) ||
      (detectCodingHelpRequest(message) &&
        history.slice(-4).some((item) => detectStillConfused(item.content))));

  const codingSystemTail = buildCodingSystemTail(message, codingNeedsAnswer, effectiveMode);
  const sourceGuidanceConstraint =
    workspaceContext.toLowerCase().includes("source guidance")
      ? "\n\nSOURCE GUIDANCE RULES:\n- Do not provide specific source titles, authors, journals, or publications.\n- Provide only source types, search terms, date ranges, and where to search (e.g., library databases, Google Scholar).\n- Keep guidance grounded in the student's section argument."
      : "";

  const anthropic = new Anthropic({ apiKey });
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: effectiveMode === "coding_review" ? 1200 : 800,
    system:
      `${victorSystemPrefix}\n\n${buildSystemPrompt(
        effectiveMode,
        intensity,
        workspaceContext
      )}${sourceGuidanceConstraint}` + codingSystemTail,
    messages: updatedHistory.map((item) => ({
      role: item.role,
      content: item.content,
    })),
  });

  const reply = enforceMathTriggerReasonReply(
    readAnthropicText(response) || "Keep going. Clarify the claim.",
    workspaceContext,
    body?.mathTriggerReason
  );
  const safeReply = enforceSourceGuidanceSafety(reply, workspaceContext);
  const finalHistory = [
    ...updatedHistory,
    {
      role: "assistant" as const,
      content: safeReply,
      timestamp: new Date().toISOString(),
    },
  ];

  await supabase
    .from("victor_conversations")
    .update({
      messages: finalHistory,
      last_message_at: new Date().toISOString(),
      mode: persistedMode,
    })
    .eq("id", currentId)
    .eq("user_id", userId);

  const mirrorCapture = await captureVictorMessageForMirror({
    supabase,
    userId,
    text: message,
    sessionId: currentId,
    mode: effectiveMode,
    workspaceContext,
  });

  return NextResponse.json(
    {
      success: true,
      conversationId: currentId,
      reply: safeReply,
      responseType: "conversation" as TeachingResponseType,
      misconceptionLevel,
      suggestedMode: null,
      requiresConfirmation: false,
      mirrorCapture,
    },
    { status: 200 }
  );
}
