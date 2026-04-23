import { NextRequest, NextResponse } from "next/server.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { VoiceFingerprint } from "@/lib/mirror-core/voiceAnalysis";
import {
  buildVoiceSystemPrompt,
  buildSubcategoryVoiceGenerationContext,
  getMaxTokens,
} from "@/lib/mirror-core/voiceGeneration";

type FeedbackBody = {
  session_id?: string;
  what_felt_off?: "tone" | "word_choices" | "structure";
  original_output?: string;
  chamber?: string;
};

type SessionRow = {
  id: string;
  user_id: string;
  generation_request: Record<string, unknown> | null;
  voiced_output: string | null;
  feedback_signals: unknown[] | null;
  messages?: unknown;
};

type VoiceChamberRow = {
  aggregate_fingerprint: VoiceFingerprint;
  confidence_level: number | null;
};

type FeedbackDeps = {
  resolveUserId: (request: NextRequest) => Promise<string | null>;
  createSupabaseServerClient: () => Promise<SupabaseClient> | SupabaseClient;
  runClaude: (input: { system: string; prompt: string; maxTokens: number }) => Promise<string>;
};

function isFeedbackType(
  value: string | null | undefined
): value is "tone" | "word_choices" | "structure" {
  return value === "tone" || value === "word_choices" || value === "structure";
}

function isPlaygroundChamber(
  value: string | null | undefined
): value is "career" | "academic" | "creative" | "general" {
  return value === "career" || value === "academic" || value === "creative" || value === "general";
}

function buildFeedbackAdjustment(
  whatFeltOff: "tone" | "word_choices" | "structure",
  originalOutput: string
) {
  if (whatFeltOff === "tone") {
    return [
      "The user rejected the tone.",
      "Explicitly avoid the tone of the original output.",
      "Lean harder into the user's natural rhythm, formality level, and emotional register from the voice fingerprint.",
      "Do not repeat the detached or over-smoothed tone that appeared before.",
      `Rejected output:\n${originalOutput}`,
    ].join("\n\n");
  }

  if (whatFeltOff === "word_choices") {
    return [
      "The user rejected the word choices.",
      "Replace formal or generic vocabulary with the user's characteristic word patterns.",
      "Adjust contractions, sentence starters, and lexical choices to match the fingerprint more tightly.",
      "Do not recycle the generic diction from the rejected version.",
      `Rejected output:\n${originalOutput}`,
    ].join("\n\n");
  }

  return [
    "The user rejected the structure.",
    "Restructure the draft using the user's characteristic sentence length, paragraph rhythm, and opening or closing patterns.",
    "Do not preserve the previous structure if it felt imposed or generic.",
    "Keep the content goal, but rebuild the pacing and arrangement from the fingerprint.",
    `Rejected output:\n${originalOutput}`,
  ].join("\n\n");
}

function buildRegenerationPrompt(
  session: SessionRow,
  originalOutput: string,
  whatFeltOff: "tone" | "word_choices" | "structure",
  chamber: string
) {
  const generationRequest = session.generation_request || {};
  const enrichment = generationRequest.enrichment && typeof generationRequest.enrichment === "object"
    ? Object.entries(generationRequest.enrichment as Record<string, string>)
        .filter(([, value]) => String(value || "").trim().length > 0)
        .map(([key, value]) => `${key}: ${value}`)
    : [];

  return [
    `Audience: ${String(generationRequest.audience || "")}`,
    `Purpose: ${String(generationRequest.purpose || "")}`,
    `Tone target: ${String(generationRequest.tone || "")}`,
    `Context chamber: ${chamber}`,
    `Core content: ${String(generationRequest.content || "")}`,
    enrichment.length > 0 ? `Additional context:\n${enrichment.join("\n")}` : "",
    buildFeedbackAdjustment(whatFeltOff, originalOutput),
    "Write only the revised final draft.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function normalizeConversationHistory(value: unknown): string {
  if (!Array.isArray(value)) return "No conversation history available.";

  const lines = value
    .filter((message): message is { role: string; text: string } => {
      if (!message || typeof message !== "object") return false;
      const candidate = message as Record<string, unknown>;
      return typeof candidate.role === "string" && typeof candidate.text === "string";
    })
    .map((message) => `${message.role}: ${message.text}`);

  return lines.length > 0 ? lines.join("\n") : "No conversation history available.";
}

function extractUserNameFromRequest(
  generationRequest: Record<string, unknown> | null | undefined,
  conversationHistory: string
) {
  const enrichment =
    generationRequest?.enrichment &&
    typeof generationRequest.enrichment === "object" &&
    generationRequest.enrichment !== null
      ? (generationRequest.enrichment as Record<string, unknown>)
      : {};

  const namesField = typeof enrichment.names === "string" ? enrichment.names.trim() : "";
  if (namesField) {
    return namesField.split(",")[0].trim();
  }

  const audienceField = typeof generationRequest?.audience === "string"
    ? generationRequest.audience.trim()
    : "";
  const audienceNameMatch = audienceField.match(/\b([A-Z][a-z]+)\b/);
  if (audienceNameMatch) {
    return audienceNameMatch[1];
  }

  const historyNameMatch = conversationHistory.match(/\b(?:user|ursie):.*?\b([A-Z][a-z]+)\b/);
  if (historyNameMatch) {
    return historyNameMatch[1];
  }

  return "You";
}

function buildFeedbackResponsePrompt(args: {
  userName: string;
  whatFeltOff: "tone" | "word_choices" | "structure";
  originalOutput: string;
  generationRequest: Record<string, unknown>;
  conversationHistory: string;
}) {
  return [
    `User name: ${args.userName}`,
    `Feedback selection: ${args.whatFeltOff}`,
    `Conversation history:\n${args.conversationHistory}`,
    `Rejected voiced output:\n${args.originalOutput}`,
    `Generation request context:\n${JSON.stringify(args.generationRequest, null, 2)}`,
    "Write Ursie's response before she fixes the draft.",
    "Short only: 1 to 3 sentences.",
    "Contain the user's name.",
    "Reference what she thought she heard in the conversation that led her there.",
    "If the selected issue is word choices or structure, she may acknowledge it directly and move.",
    "No forbidden phrases. No apology. No reassurance performance.",
    "Output only the response text.",
  ].join("\n\n");
}

function isValidFeedbackResponse(text: string, userName: string) {
  const normalized = text.trim();
  if (!normalized) return false;
  if (!normalized.toLowerCase().includes(userName.toLowerCase())) return false;

  const sentenceCount = normalized
    .split(/[.!?]+/)
    .map((part) => part.trim())
    .filter(Boolean).length;
  if (sentenceCount < 1 || sentenceCount > 3) return false;

  const lower = normalized.toLowerCase();
  return ![
    "pressure points",
    "static",
    "voice profile",
    "mirror mode",
    "i listen for",
    "i help you",
    "my purpose is",
    "i understand",
    "i apologize",
    "i'm sorry",
    "how can i help you today",
    "great question",
    "certainly",
    "of course",
    "absolutely",
    "i am an ai",
  ].some((phrase) => lower.includes(phrase));
}

export async function handlePlaygroundFeedback(request: NextRequest, deps: FeedbackDeps) {
  const userId = await deps.resolveUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as FeedbackBody | null;
  if (
    !body?.session_id ||
    !body.original_output?.trim() ||
    !isFeedbackType(body.what_felt_off) ||
    !isPlaygroundChamber(body.chamber)
  ) {
    return NextResponse.json({ error: "Invalid feedback payload" }, { status: 400 });
  }

  const supabase = await deps.createSupabaseServerClient();
  const { data: session, error: sessionError } = await supabase
    .from("mirror_playground_sessions")
    .select("id, user_id, generation_request, voiced_output, feedback_signals, messages")
    .eq("id", body.session_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (sessionError) {
    return NextResponse.json({ error: sessionError.message }, { status: 500 });
  }
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const { data: chamberRow, error: chamberError } = await supabase
    .from("voice_chambers")
    .select("aggregate_fingerprint, confidence_level")
    .eq("user_id", userId)
    .eq("chamber", body.chamber)
    .maybeSingle();

  if (chamberError) {
    return NextResponse.json({ error: chamberError.message }, { status: 500 });
  }

  const voiceRow = chamberRow as VoiceChamberRow | null;
  const generationRequest =
    (session as SessionRow).generation_request &&
    typeof (session as SessionRow).generation_request === "object"
      ? ((session as SessionRow).generation_request as Record<string, unknown>)
      : {};
  const conversationHistory = normalizeConversationHistory((session as SessionRow).messages);
  const userName = extractUserNameFromRequest(
    (session as SessionRow).generation_request,
    conversationHistory
  );
  const subcategoryId =
    typeof generationRequest.subcategory_id === "string" && generationRequest.subcategory_id.trim()
      ? generationRequest.subcategory_id.trim()
      : undefined;
  const subcategoryContext = subcategoryId
    ? await buildSubcategoryVoiceGenerationContext({
        userId,
        chamber: body.chamber,
        subcategoryId,
        toneOverride: "match",
        supabase,
      })
    : null;
  const system = subcategoryContext
    ? subcategoryContext.systemPrompt
    : voiceRow?.aggregate_fingerprint
    ? buildVoiceSystemPrompt(voiceRow.aggregate_fingerprint, "match")
    : [
        "You are a writing assistant.",
        "Write clear, competent prose.",
        "Do not add generic filler or generic AI polish.",
        "Deliver only the revised final draft.",
      ].join(" ");

  const regenerated_output = await deps.runClaude({
    system,
    prompt: buildRegenerationPrompt(
      session as SessionRow,
      body.original_output.trim(),
      body.what_felt_off,
      body.chamber
    ),
    maxTokens: getMaxTokens("medium"),
  });

  let ursieFeedbackResponse: string | null = null;
  try {
    const feedbackResponseText = await deps.runClaude({
      system: [
        "You are Ursie.",
        "Address the user by name when it matters.",
        "You are direct, precise, and unsentimental.",
        "You do not apologize.",
        "You do not use forbidden phrases or product language.",
        "Respond like someone who already started fixing the draft.",
      ].join(" "),
      prompt: buildFeedbackResponsePrompt({
        userName,
        whatFeltOff: body.what_felt_off,
        originalOutput: body.original_output.trim(),
        generationRequest,
        conversationHistory,
      }),
      maxTokens: getMaxTokens("short"),
    });

    if (isValidFeedbackResponse(feedbackResponseText, userName)) {
      ursieFeedbackResponse = feedbackResponseText.trim();
    }
  } catch (error) {
    console.warn("[Mirror Playground Feedback] failed to generate Ursie response:", error);
  }

  const existingSignals = Array.isArray((session as SessionRow).feedback_signals)
    ? ([...(session as SessionRow).feedback_signals!] as unknown[])
    : [];
  existingSignals.push({
    what_felt_off: body.what_felt_off,
    created_at: new Date().toISOString(),
  });

  const { error: updateError } = await supabase
    .from("mirror_playground_sessions")
    .update({
      voiced_output: regenerated_output,
      feedback_signals: existingSignals,
      updated_at: new Date().toISOString(),
    })
    .eq("id", body.session_id)
    .eq("user_id", userId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const { error: feedbackError } = await supabase
    .from("mirror_playground_feedback")
    .insert({
      user_id: userId,
      session_id: body.session_id,
      feedback_type: "not_my_voice",
      what_felt_off: body.what_felt_off,
      original_output: body.original_output.trim(),
      regenerated_output,
      chamber: body.chamber,
      created_at: new Date().toISOString(),
    });

  if (feedbackError) {
    console.warn("[Mirror Playground Feedback] failed to log feedback:", feedbackError.message);
  }

  return NextResponse.json(
    {
      regenerated_output,
      ursie_feedback_response: ursieFeedbackResponse,
    },
    { status: 200 }
  );
}
