import { NextRequest, NextResponse } from "next/server.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import {
  ingestConversationMessage,
  type PlaygroundConversationIngestionResult,
  shouldIngest,
} from "@/lib/mirror-mode/playgroundIngestion";
import {
  extractContextObservations,
  generateUrsieRecommendationMessage,
  type ContextObservations,
} from "@/lib/mirror-core/contextMemoryService";
import {
  detectAcknowledgment,
  generateRedirectMessage,
} from "@/lib/mirror-mode/playgroundAcknowledgment";

type SessionReadDeps = {
  resolveUserId: (request: NextRequest) => Promise<string | null>;
  createSupabaseServerClient: () => Promise<SupabaseClient> | SupabaseClient;
};

type SessionUpdateDeps = SessionReadDeps & {
  shouldIngest: typeof shouldIngest;
  ingestConversationMessage: (
    userId: string,
    message: string,
    chamber: string,
    sessionId: string
  ) => Promise<PlaygroundConversationIngestionResult | void>;
  extractContextObservations?: typeof extractContextObservations;
  generateUrsieRecommendationMessage?: typeof generateUrsieRecommendationMessage;
  detectAcknowledgment?: typeof detectAcknowledgment;
  generateRedirectMessage?: typeof generateRedirectMessage;
};

type UpdateSessionBody = {
  messages?: unknown;
  context_memory?: Record<string, unknown>;
  conversation_onboarding?: boolean;
  capture_enabled?: boolean;
};

type SessionMessage = {
  id: string;
  role: "user" | "ursie";
  text: string;
};

type SessionRow = {
  id: string;
  user_id: string;
  messages: unknown;
  context_memory: Record<string, unknown> | null;
  chamber: string | null;
  conversation_onboarding?: boolean;
  pending_queue_acknowledgment?: boolean;
  acknowledgment_redirect_count?: number;
  patience_exhausted?: boolean;
  low_quality_response_count?: number;
};

type QueueInsertRow = {
  id: string;
};

const URSIE_ACKNOWLEDGMENT_SYSTEM_PROMPT = `
You are Ursie — a direct, stern mother-mentor. You are polite to the user's face, but clipped and no-nonsense. You do not use pet names.

Hard rules:
- Be concise, matter-of-fact, and helpful.
- Do not apologize.
- Stay in writing and voice scope.
- If you redirect, do it like a person who remembers what she asked and expects acknowledgment.
- Never sound bureaucratic or templated.
`.trim();

const FORBIDDEN_URSIE_PHRASES = [
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
];

const PATIENCE_EXHAUSTED_SYSTEM_PROMPT = `
You are Ursie.

You are direct, exact, unsentimental, and occasionally poetic when precision requires it.
You do not apologize. You do not soothe. You do not perform patience you no longer have.
The user's name matters. Use it like a person uses a name.
This register is the end of your patience. It is sarcastic, precise, and devastating without becoming rude.
It means the conversation is not going anywhere until the user brings back something real.
Never use forbidden phrases or product language.
`.trim();

function getAnthropicClient() {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new Anthropic({ apiKey });
}

async function runClaude(system: string, prompt: string, maxTokens: number) {
  const anthropic = getAnthropicClient();
  if (!anthropic) {
    throw new Error("Claude API key not configured");
  }

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: prompt }],
  });

  return response.content?.map((part) => ("text" in part ? part.text : "")).join("\n").trim() || "";
}

function isSessionMessage(value: unknown): value is SessionMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Record<string, unknown>;
  return (
    typeof message.id === "string" &&
    (message.role === "user" || message.role === "ursie") &&
    typeof message.text === "string"
  );
}

function normalizeMessages(value: unknown): SessionMessage[] {
  return Array.isArray(value) ? value.filter(isSessionMessage) : [];
}

function resolveIngestionChamber(chamber: string | null | undefined): "career" | "academic" | "creative" | "general" {
  return chamber === "career" || chamber === "academic" || chamber === "creative" || chamber === "general"
    ? chamber
    : "general";
}

function countWords(message: string): number {
  return message.trim().split(/\s+/).filter(Boolean).length;
}

function hasMeaningfulContext(observations: ContextObservations): boolean {
  return observations.people.length > 0 || observations.writing_type.trim().length > 0;
}

function getLatestUrsieContext(messages: SessionMessage[]): string {
  const latestUrsie = [...messages].reverse().find((message) => message.role === "ursie");
  return latestUrsie?.text || "the queue item I surfaced a moment ago";
}

function sentenceCount(text: string): number {
  return text
    .split(/[.!?]+/)
    .map((part) => part.trim())
    .filter(Boolean).length;
}

function containsQuestionCue(text: string): boolean {
  return /\?$|\b(what|where|when|who|why|how)\b/i.test(text);
}

function containsNamedEntity(text: string): boolean {
  return (
    /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/.test(text) ||
    /\b(?:Inc|LLC|Corp|Corporation|Company|University|College|Street|Road|Avenue|Boulevard)\b/i.test(text) ||
    /\b\d{4}\b/.test(text) ||
    /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b/i.test(text)
  );
}

function isEvasiveResponse(text: string): boolean {
  return /^(yes|yeah|yep|no|nope|maybe|whatever|just do it|figure it out|doesn't matter|does not matter|up to you|i don't know|idk|not sure|you decide)\b/i.test(
    text.trim()
  );
}

function isLowQualityResponse(previousMessage: SessionMessage | undefined, userMessage: string): boolean {
  if (!previousMessage || previousMessage.role !== "ursie") {
    return false;
  }

  return (
    containsQuestionCue(previousMessage.text) &&
    countWords(userMessage) < 10 &&
    !containsNamedEntity(userMessage) &&
    isEvasiveResponse(userMessage)
  );
}

function isSubstantialMessage(text: string): boolean {
  return (
    countWords(text) > 25 ||
    containsNamedEntity(text) ||
    /\b(i need|write|draft|rewrite|email|letter|statement|essay|note|message|for|to)\b/i.test(text)
  );
}

function getUserName(contextMemory: Record<string, unknown> | null | undefined): string {
  const values = [
    contextMemory?.user_name,
    contextMemory?.display_name,
    contextMemory?.manager_name,
    contextMemory?.professor_name,
  ];

  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim().split(/\s+/)[0];
    }
  }

  return "You";
}

function isValidPatienceResponse(text: string, userName: string) {
  const normalized = text.trim();
  if (!normalized) return false;
  if (!normalized.toLowerCase().includes(userName.toLowerCase())) return false;
  if (sentenceCount(normalized) > 4) return false;

  const lower = normalized.toLowerCase();
  return !FORBIDDEN_URSIE_PHRASES.some((phrase) => lower.includes(phrase));
}

function buildPatienceFallback(userName: string, exhausted: boolean) {
  if (exhausted) {
    return `${userName}. How may I assist you, if assistance is in fact what you came here for. Bring me something real, or leave it where it is.`;
  }

  return `${userName}. I am still waiting for something I can actually work with.`;
}

async function generatePatienceResponse(args: {
  userName: string;
  previousQuestion: string;
  userMessage: string;
  exhausted: boolean;
}) {
  const prompt = [
    args.exhausted
      ? "Ursie has asked direct questions and received nothing worth working with. This is her end-of-patience response."
      : "Ursie is still waiting after patience was exhausted. This is a brief acknowledgment only.",
    `User name: ${args.userName}`,
    `Previous Ursie question: ${args.previousQuestion}`,
    `User response: ${args.userMessage}`,
    args.exhausted
      ? "Write 1 to 3 sentences. Sarcastic, poetic, precise. Not rude. It should land like a blade wrapped in silk."
      : "Write 1 to 2 sentences. Short. Precise. She is still waiting.",
    "Contain the user's name.",
    "No forbidden phrases.",
  ].join("\n\n");

  try {
    let response = await runClaude(PATIENCE_EXHAUSTED_SYSTEM_PROMPT, prompt, 180);
    if (!isValidPatienceResponse(response, args.userName)) {
      response = await runClaude(
        PATIENCE_EXHAUSTED_SYSTEM_PROMPT,
        `${prompt}\n\nYour first attempt violated the rules. Fix it now.`,
        180
      );
    }

    return isValidPatienceResponse(response, args.userName)
      ? response.trim()
      : buildPatienceFallback(args.userName, args.exhausted);
  } catch {
    return buildPatienceFallback(args.userName, args.exhausted);
  }
}

async function persistSessionUpdate(
  supabase: SupabaseClient,
  sessionId: string,
  userId: string,
  values: Record<string, unknown>
) {
  const { error } = await supabase
    .from("mirror_playground_sessions")
    .update(values)
    .eq("id", sessionId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function handleGetPlaygroundSession(
  request: NextRequest,
  params: { id: string },
  deps: SessionReadDeps
) {
  const userId = await deps.resolveUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const supabase = await deps.createSupabaseServerClient();
  const { data, error } = await supabase
    .from("mirror_playground_sessions")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json({ session: data }, { status: 200 });
}

export async function handleUpdatePlaygroundSession(
  request: NextRequest,
  params: { id: string },
  deps: SessionUpdateDeps
) {
  const userId = await deps.resolveUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as UpdateSessionBody | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid session payload" }, { status: 400 });
  }

  const supabase = await deps.createSupabaseServerClient();
  const { data: existingSession, error: sessionError } = await supabase
    .from("mirror_playground_sessions")
    .select(
      "id, user_id, messages, context_memory, chamber, conversation_onboarding, pending_queue_acknowledgment, acknowledgment_redirect_count, patience_exhausted, low_quality_response_count"
    )
    .eq("id", params.id)
    .eq("user_id", userId)
    .maybeSingle();

  if (sessionError) {
    return NextResponse.json({ error: sessionError.message }, { status: 500 });
  }

  if (!existingSession) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const nextMessages = body.messages !== undefined ? normalizeMessages(body.messages) : null;
  const previousMessages = normalizeMessages((existingSession as SessionRow).messages);
  const previousIds = new Set(previousMessages.map((message) => message.id));
  const newUserMessages = nextMessages
    ? nextMessages.filter((message) => !previousIds.has(message.id) && message.role === "user")
    : [];
  const latestIncomingUserMessage = newUserMessages[newUserMessages.length - 1] || null;
  const resolvedChamber = resolveIngestionChamber((existingSession as SessionRow).chamber);
  const extractObservations = deps.extractContextObservations || extractContextObservations;
  const buildNotification =
    deps.generateUrsieRecommendationMessage || generateUrsieRecommendationMessage;
  const checkAcknowledgment = deps.detectAcknowledgment || detectAcknowledgment;
  const buildRedirectMessage = deps.generateRedirectMessage || generateRedirectMessage;
  let ursieNotification: string | null = null;
  let ursieResponse: string | null = null;
  let continueProcessing = true;
  let pendingQueueAcknowledgment = Boolean(
    (existingSession as SessionRow).pending_queue_acknowledgment
  );
  let acknowledgmentRedirectCount =
    (existingSession as SessionRow).acknowledgment_redirect_count ?? 0;
  let patienceExhausted = Boolean((existingSession as SessionRow).patience_exhausted);
  let lowQualityResponseCount = (existingSession as SessionRow).low_quality_response_count ?? 0;
  const userName = getUserName((existingSession as SessionRow).context_memory);

  if (pendingQueueAcknowledgment && latestIncomingUserMessage) {
    if (checkAcknowledgment(latestIncomingUserMessage.text)) {
      pendingQueueAcknowledgment = false;
      acknowledgmentRedirectCount = 0;
    } else {
      acknowledgmentRedirectCount += 1;
      ursieResponse = await buildRedirectMessage(
        {
          redirectCount: acknowledgmentRedirectCount,
          recommendationContext: getLatestUrsieContext(previousMessages),
          userMessage: latestIncomingUserMessage.text,
        },
        URSIE_ACKNOWLEDGMENT_SYSTEM_PROMPT
      );

      if (acknowledgmentRedirectCount < 3) {
        await persistSessionUpdate(supabase, params.id, userId, {
          messages: body.messages !== undefined ? body.messages : (existingSession as SessionRow).messages,
          context_memory:
            body.context_memory !== undefined
              ? body.context_memory
              : (existingSession as SessionRow).context_memory,
          conversation_onboarding:
            body.conversation_onboarding !== undefined
              ? body.conversation_onboarding
              : Boolean((existingSession as SessionRow).conversation_onboarding),
          pending_queue_acknowledgment: true,
          acknowledgment_redirect_count: acknowledgmentRedirectCount,
          updated_at: new Date().toISOString(),
        });

        return NextResponse.json(
          {
            success: true,
            ursie_response: ursieResponse,
            continue_processing: false,
          },
          { status: 200 }
        );
      }

      pendingQueueAcknowledgment = false;
      acknowledgmentRedirectCount = 0;
      continueProcessing = true;
    }
  }

  if (!pendingQueueAcknowledgment && latestIncomingUserMessage) {
    const previousUrsieMessage = [...previousMessages]
      .reverse()
      .find((message) => message.role === "ursie");

    if (patienceExhausted) {
      if (isSubstantialMessage(latestIncomingUserMessage.text)) {
        patienceExhausted = false;
        lowQualityResponseCount = 0;
      } else {
        ursieResponse = await generatePatienceResponse({
          userName,
          previousQuestion: previousUrsieMessage?.text || "What do you need?",
          userMessage: latestIncomingUserMessage.text,
          exhausted: false,
        });

        await persistSessionUpdate(supabase, params.id, userId, {
          messages: body.messages !== undefined ? body.messages : (existingSession as SessionRow).messages,
          context_memory:
            body.context_memory !== undefined
              ? body.context_memory
              : (existingSession as SessionRow).context_memory,
          conversation_onboarding:
            body.conversation_onboarding !== undefined
              ? body.conversation_onboarding
              : Boolean((existingSession as SessionRow).conversation_onboarding),
          pending_queue_acknowledgment: false,
          acknowledgment_redirect_count: acknowledgmentRedirectCount,
          patience_exhausted: true,
          low_quality_response_count: 0,
          updated_at: new Date().toISOString(),
        });

        return NextResponse.json(
          {
            success: true,
            ursie_response: ursieResponse,
            continue_processing: false,
          },
          { status: 200 }
        );
      }
    } else if (isLowQualityResponse(previousUrsieMessage, latestIncomingUserMessage.text)) {
      lowQualityResponseCount += 1;

      if (lowQualityResponseCount >= 3) {
        ursieResponse = await generatePatienceResponse({
          userName,
          previousQuestion: previousUrsieMessage?.text || "What do you need?",
          userMessage: latestIncomingUserMessage.text,
          exhausted: true,
        });
        patienceExhausted = true;
        lowQualityResponseCount = 0;

        await persistSessionUpdate(supabase, params.id, userId, {
          messages: body.messages !== undefined ? body.messages : (existingSession as SessionRow).messages,
          context_memory:
            body.context_memory !== undefined
              ? body.context_memory
              : (existingSession as SessionRow).context_memory,
          conversation_onboarding:
            body.conversation_onboarding !== undefined
              ? body.conversation_onboarding
              : Boolean((existingSession as SessionRow).conversation_onboarding),
          pending_queue_acknowledgment: false,
          acknowledgment_redirect_count: acknowledgmentRedirectCount,
          patience_exhausted: true,
          low_quality_response_count: 0,
          updated_at: new Date().toISOString(),
        });

        return NextResponse.json(
          {
            success: true,
            ursie_response: ursieResponse,
            continue_processing: false,
          },
          { status: 200 }
        );
      }
    } else {
      lowQualityResponseCount = 0;
    }
  }

  if (nextMessages && body.capture_enabled !== false && continueProcessing) {
    for (const message of newUserMessages) {
      if (!deps.shouldIngest(message.text)) {
        continue;
      }

      const ingestionResult = await deps.ingestConversationMessage(
        userId,
        message.text,
        resolvedChamber,
        params.id
      );
      const observations = await extractObservations(
        message.text,
        (existingSession as SessionRow).context_memory || undefined
      );

      if (!hasMeaningfulContext(observations)) {
        continue;
      }

      const { data: queueItem, error: queueError } = await supabase
        .from("mirror_unclassified_queue")
        .insert({
          user_id: userId,
          source_domain: "playground",
          capture_source: "playground",
          fingerprint_data: {
            session_id: params.id,
            session_message_id: message.id,
            mirror_document_id:
              ingestionResult &&
              typeof ingestionResult === "object" &&
              "mirrorDocumentId" in ingestionResult
                ? ingestionResult.mirrorDocumentId
                : null,
            chamber: resolvedChamber,
          },
          word_count: countWords(message.text),
          captured_at: new Date().toISOString(),
          context_observations: observations,
          ursie_recommendation: {
            chamber: observations.recommended_chamber,
            subcategory_name: observations.recommended_subcategory,
            confidence: observations.recommendation_confidence,
            reasoning: observations.recommendation_reasoning,
          },
        })
        .select("id")
        .single();

      if (queueError) {
        return NextResponse.json({ error: queueError.message }, { status: 500 });
      }

      void (queueItem as QueueInsertRow | null);
      ursieNotification = await buildNotification(observations, userId);
    }
  }

  const updatePayload: {
    messages?: unknown;
    context_memory?: Record<string, unknown>;
    conversation_onboarding?: boolean;
    pending_queue_acknowledgment?: boolean;
    acknowledgment_redirect_count?: number;
    patience_exhausted?: boolean;
    low_quality_response_count?: number;
    updated_at: string;
  } = {
    updated_at: new Date().toISOString(),
  };

  if (body.messages !== undefined) {
    updatePayload.messages = body.messages;
  }

  if (body.context_memory !== undefined) {
    updatePayload.context_memory = body.context_memory;
  }

  if (body.conversation_onboarding !== undefined) {
    updatePayload.conversation_onboarding = body.conversation_onboarding;
  }

  updatePayload.pending_queue_acknowledgment = pendingQueueAcknowledgment;
  updatePayload.acknowledgment_redirect_count = acknowledgmentRedirectCount;
  updatePayload.patience_exhausted = patienceExhausted;
  updatePayload.low_quality_response_count = lowQualityResponseCount;

  if (ursieNotification) {
    updatePayload.pending_queue_acknowledgment = true;
    updatePayload.acknowledgment_redirect_count = 0;
  }

  try {
    await persistSessionUpdate(supabase, params.id, userId, updatePayload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update session" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      success: true,
      ursie_notification: ursieNotification,
      ursie_response: ursieResponse,
      continue_processing: continueProcessing,
    },
    { status: 200 }
  );
}
