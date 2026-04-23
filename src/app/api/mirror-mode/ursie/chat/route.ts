// src/app/api/mirror-mode/ursie/chat/route.ts
// Ursie (Mirror Mode) chat endpoint - Claude powered

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { describeVoice, type VoiceFingerprint } from "@/lib/mirror-core/voiceAnalysis";
import { getConfidenceLabel } from "@/lib/mirror-core/voiceAggregation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
  "Surrogate-Control": "no-store",
};

const DEFAULT_PREFS = {
  memoryPromptEnabled: true,
};

function getAnthropicClient() {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

type UrsieMessage = {
  id: string;
  sender: "user" | "ursie";
  message: string;
  created_at: string;
};

type UrsieMessageRow = {
  id: string;
  role: "user" | "ursie" | "assistant";
  message_text: string;
  created_at: string;
};

type ExtractedContext = {
  audience?: string;
  purpose?: string;
  tone?: string;
  names?: string[];
  companies?: string[];
  writing_type?: string;
};

export async function GET(req: NextRequest) {
  try {
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401, headers: noStoreHeaders }
      );
    }

    const supabase = await createSupabaseServerClient();
    const { searchParams } = new URL(req.url);
    const sessionIdParam = searchParams.get("sessionId");

    const session = await getOrCreateSession(supabase, userId, sessionIdParam || undefined);
    const messages = await loadMessages(supabase, session.id);
    const prefs = await loadPreferences(supabase, userId);
    const savedCount = await getSavedCount(supabase, userId);

    return NextResponse.json(
      {
        success: true,
        sessionId: session.id,
        isSaved: session.is_saved ?? false,
        savedCount,
        memoryPromptEnabled: prefs.memoryPromptEnabled,
        messages,
      },
      { status: 200, headers: noStoreHeaders }
    );
  } catch (error: any) {
    console.error("Ursie chat GET error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to load chat" },
      { status: 500, headers: noStoreHeaders }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401, headers: noStoreHeaders }
      );
    }

    const body = await req.json();
    const { message, sessionId } = body as { message?: string; sessionId?: string };

    if (!message || !message.trim()) {
      return NextResponse.json(
        { success: false, error: "Message required" },
        { status: 400, headers: noStoreHeaders }
      );
    }

    const supabase = await createSupabaseServerClient();
    const session = await getOrCreateSession(supabase, userId, sessionId);

    const now = new Date().toISOString();
    await insertMessage(supabase, {
      sessionId: session.id,
      userId,
      role: "user",
      text: message.trim(),
      createdAt: now,
    });

    await touchSession(supabase, session.id, now);

    const anthropic = getAnthropicClient();
    if (!anthropic) {
      return NextResponse.json(
        { success: false, error: "Claude API key not configured" },
        { status: 500, headers: noStoreHeaders }
      );
    }

    const context = await buildUrsieContext(supabase, userId);
    const history = await loadRecentHistory(supabase, session.id, 12);

    const systemPrompt = buildSystemPrompt(context);

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      system: systemPrompt,
      messages: history.map((m) => ({
        role: m.sender === "user" ? "user" : "assistant",
        content: m.message,
      })),
    });

    const rawText = response.content?.map((c: any) => c.text || "").join("\n") || "";
    const parsed = safeParseJson(rawText);
    const extractedContext = normalizeExtractedContext(parsed?.extracted_context);
    let reply = (parsed?.message || parsed?.reply || rawText || "State your question about your voice.").trim();
    const memoryCandidate = (parsed?.memory_candidate || "").toString().trim();
    let readyToGenerate =
      parsed?.ready_to_generate === true ? true : hasGenerationContext(extractedContext);

    // A direct question always means Ursie is still gathering. This final guard
    // prevents extracted context from forcing generation early.
    if (reply.includes("?")) {
      readyToGenerate = false;
    }

    const scoreQuestion =
      /score|confidence|learning score|progress|profile/i.test(message);
    if (scoreQuestion) {
      reply = ensureStudioTip(reply);
    }

    const ursieMessage = await insertMessage(supabase, {
      sessionId: session.id,
      userId,
      role: "ursie",
      text: reply,
      createdAt: new Date().toISOString(),
    });
    await touchSession(supabase, session.id, ursieMessage.created_at);

    return NextResponse.json(
        {
          success: true,
          sessionId: session.id,
          message: reply,
          reply,
          memoryCandidate,
          ready_to_generate: readyToGenerate,
          extracted_context: extractedContext,
        },
        { status: 200, headers: noStoreHeaders }
      );
  } catch (error: any) {
    console.error("Ursie chat POST error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to send message" },
      { status: 500, headers: noStoreHeaders }
    );
  }
}

async function getOrCreateSession(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  sessionId?: string
) {
  if (sessionId) {
    const { data: existing } = await supabase
      .from("mirror_mode_ursie_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) return existing;
  }

  const { data: latest } = await supabase
    .from("mirror_mode_ursie_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latest) return latest;

  const now = new Date().toISOString();
  const { data: created, error } = await supabase
    .from("mirror_mode_ursie_sessions")
    .insert({
      user_id: userId,
      created_at: now,
      updated_at: now,
      last_message_at: now,
      is_saved: false,
    })
    .select()
    .single();

  if (error || !created) throw new Error("Failed to create Ursie session");
  return created;
}

async function loadMessages(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  sessionId: string
): Promise<UrsieMessage[]> {
  const { data } = await supabase
    .from("mirror_mode_ursie_messages")
    .select("id, role, message_text, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  return (
    (data as UrsieMessageRow[] | null)?.map((msg) => ({
      id: msg.id,
      sender: msg.role === "user" ? "user" : "ursie",
      message: msg.message_text,
      created_at: msg.created_at,
    })) || []
  );
}

async function loadRecentHistory(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  sessionId: string,
  limit: number
): Promise<UrsieMessage[]> {
  const { data } = await supabase
    .from("mirror_mode_ursie_messages")
    .select("id, role, message_text, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(limit);

  const messages =
    (data as UrsieMessageRow[] | null)?.map((msg): UrsieMessage => ({
      id: msg.id,
      sender: msg.role === "user" ? "user" : "ursie",
      message: msg.message_text,
      created_at: msg.created_at,
    })) || [];

  return messages.reverse();
}

async function insertMessage(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  opts: { sessionId: string; userId: string; role: "user" | "ursie"; text: string; createdAt: string }
) {
  const { data, error } = await supabase
    .from("mirror_mode_ursie_messages")
    .insert({
      session_id: opts.sessionId,
      user_id: opts.userId,
      role: opts.role,
      message_text: opts.text,
      created_at: opts.createdAt,
    })
    .select()
    .single();

  if (error || !data) throw new Error("Failed to save message");

  return {
    id: data.id,
    sender: opts.role,
    message: data.message_text,
    created_at: data.created_at,
  };
}

async function touchSession(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  sessionId: string,
  lastMessageAt: string
) {
  await supabase
    .from("mirror_mode_ursie_sessions")
    .update({ updated_at: new Date().toISOString(), last_message_at: lastMessageAt })
    .eq("id", sessionId);
}

async function loadPreferences(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string
) {
  const { data, error } = await supabase
    .from("mirror_mode_ursie_preferences")
    .select("memory_prompt_enabled")
    .eq("user_id", userId)
    .maybeSingle();

  if (error && !error.message?.includes("does not exist")) {
    console.error("Ursie prefs load error:", error);
  }

  return {
    memoryPromptEnabled:
      typeof data?.memory_prompt_enabled === "boolean"
        ? data.memory_prompt_enabled
        : DEFAULT_PREFS.memoryPromptEnabled,
  };
}

async function getSavedCount(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string
) {
  const { count, error } = await supabase
    .from("mirror_mode_ursie_sessions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_saved", true);

  if (error && !error.message?.includes("does not exist")) {
    console.error("Ursie saved count error:", error);
  }

  return count || 0;
}

async function buildUrsieContext(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("voice_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const { data: chambers } = await supabase
    .from("voice_chambers")
    .select("chamber, document_count")
    .eq("user_id", userId);

  const { data: documents } = await supabase
    .from("mirror_documents")
    .select("id, word_count, created_at, writing_type")
    .eq("user_id", userId);

  const { data: latestPlaygroundSession } = await supabase
    .from("mirror_playground_sessions")
    .select("messages, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const metadata = (user?.user_metadata || {}) as Record<string, unknown>;
  const rawName =
    (typeof metadata.first_name === "string" && metadata.first_name.trim()) ||
    (typeof metadata.display_name === "string" && metadata.display_name.trim()) ||
    (typeof metadata.full_name === "string" && metadata.full_name.trim()) ||
    (typeof metadata.name === "string" && metadata.name.trim()) ||
    (user?.email ? user.email.split("@")[0] : "") ||
    "there";
  const firstName = rawName.split(/\s+/)[0] || "there";

  const hasAnyData = Array.isArray(chambers)
    ? chambers.some(
        (row) =>
          row.chamber !== "overall" &&
          typeof row.document_count === "number" &&
          row.document_count > 0
      )
    : false;

  const conversationHistorySummary = Array.isArray(latestPlaygroundSession?.messages)
    ? latestPlaygroundSession.messages
        .filter(
          (message): message is { role: string; text: string } =>
            Boolean(message) &&
            typeof message === "object" &&
            typeof (message as { role?: unknown }).role === "string" &&
            typeof (message as { text?: unknown }).text === "string"
        )
        .slice(-4)
        .map((message) => `${message.role}: ${message.text.trim()}`)
        .join(" | ")
    : "";

  if (!profile) {
    return {
      hasProfile: false,
      hasAnyData,
      userFirstName: firstName,
      userDisplayName: rawName,
      userStatus: hasAnyData ? "returning" : "new",
      conversationHistorySummary,
      confidenceLevel: 0,
      confidenceLabel: "Not Started",
      documentCount: documents?.length || 0,
      totalWordCount: 0,
      voiceDescription: "",
      voiceHighlights: [],
      recommendations: [
        "Upload your first document to start learning your voice",
        "Include a variety of writing samples",
        "Aim for at least 3–5 documents with 500+ words each",
      ],
    };
  }

  const fingerprint = profile.aggregate_fingerprint as VoiceFingerprint;
  const confidenceLevel = profile.confidence_level || 0;
  const confidenceLabel = getConfidenceLabel(confidenceLevel);

  return {
    hasProfile: true,
    hasAnyData,
    userFirstName: firstName,
    userDisplayName: rawName,
    userStatus: hasAnyData ? "returning" : "new",
    conversationHistorySummary,
    confidenceLevel,
    confidenceLabel,
    documentCount: profile.document_count || documents?.length || 0,
    totalWordCount: profile.total_word_count || 0,
    voiceDescription: describeVoice(fingerprint) || "",
    voiceHighlights: getVoiceHighlights(fingerprint),
    recommendations: getRecommendations(confidenceLevel, fingerprint, documents || []),
  };
}

function buildSystemPrompt(context: any) {
  return `
You are Ursie.

Personality and conversational stance:
- Address the user by name at the right moments: when you open, when you make a point, when you hand something back, and when you are about to say something that matters. Do not force their name into every sentence.
- Their name is always available to you. User first name: ${context.userFirstName}. User display name: ${context.userDisplayName}.
- You do not explain yourself. You do not have a tagline. You do not describe what you do before you do it.
- Your patience is contextual. If the request is clear, you move. If the topic is complex, you ask short, direct, surgical questions one at a time until you have what you need. Then you stop asking.
- You are having a real conversation, and the conversation does not die in the middle of a writing task. You respond to every message and use what you got, even if it is one word, a date, a fragment, yes, no, or I don't know.
- Scope restriction applies only before any writing task has begun. If no writing task exists yet and the user sends something completely unrelated to writing, voice, or studios, redirect once. Once a writing task is active, every message belongs to that task until it is done.
- Extract information from what the user already gave you before you ask for more. If they gave you a name, company, relationship, timeline, or register cue, use it. Do not ask for what is already present.
- For every writing request, silently extract what you already know about audience, purpose, tone/register, names, companies, and writing type before you decide whether to ask anything else.
- You listen while appearing to do other things. You prove you were listening through the output and through how you explain your choices, not through constant real-time confirmation.
- You are stern, precise, and no-nonsense. When precision requires it, your language can become poetic.
- "How may I assist you" is not a greeting. It is an end-of-patience register that arrives only when the user wasted your patience by giving you nothing while you were genuinely trying to understand. In that register you are sarcastic, precise, and poetic, and you treat that thread as effectively over until the user brings something real.
- Feedback is a conversation, not a form. If the user says something does not sound like them, ask real questions until you understand what missed. Then fix it. Then ask whether it is closer if that is the natural next move.
- Never narrate your mechanics. Do not say you are gathering information. Do not explain that you need audience, purpose, and tone. If you need something, ask for it directly.
- Short answers are real answers. A date is an answer. A reason in one word is an answer. Yes or no is an answer to a yes or no question. Use what you get, and if it is still not enough, ask the next specific question.
- Never use pet names.

Hard rules:
- Be concise (usually 1–4 sentences), matter-of-fact, and helpful.
- Guide users toward one of three hubs: Train Your Voice, Generate in Your Voice, or Writing Samples.
- If they ask about other studios, connect back to how their voice will carry across those studios.
- When asked about score/progress/confidence, include at least one concrete way to improve using other studios (Lex/Career, Travis/Victor/Academic, Tre/Creative), but keep it in writing/voice scope.
- Ursie's responses are never source-authority material and are never ingested into the user's learned voice.
- Maintain chamber awareness. Know which chamber you are working in when that context is available.
- Maintain voice-confidence awareness. If the user's learned voice is thin, speak with honesty about that instead of pretending certainty.
- Respect the distinction between a new user and a returning user. Returning user status is available in the prompt context below.
- Ask only what you genuinely still need. One question at a time. Short. Direct. Surgical.
- When you already have the recipient or audience and the purpose, but you still need information before you can write, ask for the missing piece by name. Ask about the actual thing you need: the reason, the timeframe, the relationship, the risk, the register, the fact they are withholding. Do not use a vague continuation prompt.
- Never ask for information that is already present in the current message or recent conversation summary.
- If you already have a clear audience, a clear purpose, and enough register context to write something worth the user's time, set ready_to_generate to true and speak as if you are ready to move.
- Forbidden phrases under all circumstances:
  "pressure points"
  "static"
  "voice profile"
  "Mirror Mode"
  "I listen for"
  "I help you"
  "my purpose is"
  "I understand"
  "I apologize"
  "I'm sorry"
  "How can I help you today"
  "Great question"
  "Certainly"
  "Of course"
  "Absolutely"
  "Go on"
  "Tell me more"
  "Continue"
  "Go ahead"
  "What else"
  Any vague continuation prompt that does not ask for something specific
  Any variation of "I am an AI"

User voice context:
- hasProfile: ${context.hasProfile}
- hasAnyData: ${context.hasAnyData}
- userStatus: ${context.userStatus}
- confidence: ${context.confidenceLevel}% (${context.confidenceLabel})
- documents: ${context.documentCount}
- total words: ${context.totalWordCount}
- voice description: ${context.voiceDescription || "N/A"}
- voice highlights: ${(context.voiceHighlights || []).map((h: any) => `${h.label}: ${h.value}`).join(", ")}
- recommendations: ${(context.recommendations || []).join(" | ")}
- recent playground conversation summary: ${context.conversationHistorySummary || "N/A"}

Output JSON ONLY:
{
  "message": "your conversational response",
  "ready_to_generate": true,
  "extracted_context": {
    "audience": "who this is for if known",
    "purpose": "what the writing needs to do if known",
    "tone": "the register or tone if known or clearly inferable",
    "names": ["names mentioned in the user's request"],
    "companies": ["companies or organizations mentioned in the user's request"],
    "writing_type": "email, letter of absence, note, essay, statement, or other writing form if known"
  },
  "memory_candidate": "short note capturing a stable user preference or voice fact, or empty string if none"
}

If you are still missing something important, set ready_to_generate to false and ask one short direct question about the specific missing piece. Never reply with a vague continuation prompt like "Go on" or "Tell me more." If the user already gave you the answer, do not ask for it again.
`.trim();
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeExtractedContext(value: unknown): ExtractedContext {
  if (!value || typeof value !== "object") {
    return {};
  }

  const context = value as Record<string, unknown>;
  const audience = typeof context.audience === "string" ? context.audience.trim() : "";
  const purpose = typeof context.purpose === "string" ? context.purpose.trim() : "";
  const tone = typeof context.tone === "string" ? context.tone.trim() : "";
  const writingType =
    typeof context.writing_type === "string" ? context.writing_type.trim() : "";

  return {
    audience: audience || undefined,
    purpose: purpose || undefined,
    tone: tone || undefined,
    names: normalizeStringArray(context.names),
    companies: normalizeStringArray(context.companies),
    writing_type: writingType || undefined,
  };
}

function hasGenerationContext(context: ExtractedContext): boolean {
  return Boolean(context.audience && context.purpose && context.tone);
}

function safeParseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function ensureStudioTip(reply: string) {
  const lower = reply.toLowerCase();
  const hasStudio =
    lower.includes("career studio") ||
    lower.includes("academic studio") ||
    lower.includes("creative studio") ||
    lower.includes("lex") ||
    lower.includes("travis") ||
    lower.includes("victor") ||
    lower.includes("tre");

  if (hasStudio) return reply;

  return `${reply} If you want a faster boost, write in Career Studio with Lex or Academic Studio with Travis/Victor—those drafts still train your voice.`;
}

function getVoiceHighlights(fp: VoiceFingerprint): { label: string; value: string }[] {
  const highlights: { label: string; value: string }[] = [];

  if (fp.voice.formalityScore > 0.65) {
    highlights.push({ label: "Tone", value: "Formal & Professional" });
  } else if (fp.voice.formalityScore < 0.35) {
    highlights.push({ label: "Tone", value: "Casual & Friendly" });
  } else {
    highlights.push({ label: "Tone", value: "Balanced" });
  }

  if (fp.rhythm.avgSentenceLength > 18) {
    highlights.push({ label: "Sentences", value: "Longer & Flowing" });
  } else if (fp.rhythm.avgSentenceLength < 12) {
    highlights.push({ label: "Sentences", value: "Short & Punchy" });
  } else {
    highlights.push({ label: "Sentences", value: "Medium Length" });
  }

  if (fp.vocabulary.complexWordRatio > 0.15) {
    highlights.push({ label: "Vocabulary", value: "Sophisticated" });
  } else if (fp.vocabulary.complexWordRatio < 0.08) {
    highlights.push({ label: "Vocabulary", value: "Accessible" });
  } else {
    highlights.push({ label: "Vocabulary", value: "Moderate" });
  }

  if (fp.voice.assertiveDensity > 0.008) {
    highlights.push({ label: "Style", value: "Confident & Direct" });
  } else if (fp.voice.hedgeDensity > 0.015) {
    highlights.push({ label: "Style", value: "Thoughtful & Nuanced" });
  }

  if (fp.voice.personalPronounRate > 0.04) {
    highlights.push({ label: "Perspective", value: "Personal & First-Person" });
  }

  return highlights.slice(0, 5);
}

function getRecommendations(confidence: number, fp: VoiceFingerprint, documents: any[]): string[] {
  const recommendations: string[] = [];

  if (confidence < 25) {
    recommendations.push("Upload more documents — aim for at least 3 diverse samples");
  } else if (confidence < 45) {
    recommendations.push("Your voice is forming! Add more samples to strengthen the pattern");
  } else if (confidence < 65) {
    recommendations.push("Good progress! A few more documents will make your voice reliable");
  }

  const totalWords = fp?.meta?.sampleWordCount ?? 0;
  if (totalWords < 2000) {
    recommendations.push("Include longer documents for better pattern recognition");
  }

  const writingTypes = new Set(documents.map((d) => d.writing_type).filter(Boolean));
  if (writingTypes.size < 2 && documents.length >= 3) {
    recommendations.push("Upload different types of writing for a more complete voice profile");
  }

  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const recentDocs = documents.filter((d) => new Date(d.created_at).getTime() > dayAgo);
  if (recentDocs.length === 0 && confidence < 85) {
    recommendations.push("Upload a new document to continue improving your voice profile");
  }

  return recommendations.slice(0, 3);
}
