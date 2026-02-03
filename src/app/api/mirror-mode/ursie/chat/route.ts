// src/app/api/mirror-mode/ursie/chat/route.ts
// Ursie (Mirror Mode) chat endpoint - Claude powered

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { describeVoice, type VoiceFingerprint } from "@/lib/mirror-mode/voiceAnalysis";
import { getConfidenceLabel } from "@/lib/mirror-mode/voiceAggregation";

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

const ALLOWED_KEYWORDS = [
  "write",
  "writing",
  "voice",
  "style",
  "tone",
  "grammar",
  "clarity",
  "sound",
  "authentic",
  "authenticity",
  "cadence",
  "rhythm",
  "flow",
  "edit",
  "rewrite",
  "revise",
  "document",
  "sample",
  "mirror mode",
  "ursie",
  "career studio",
  "academic studio",
  "creative studio",
  "lex",
  "travis",
  "victor",
  "tre",
  "confidence",
  "score",
  "learning score",
  "progress",
  "profile",
  "readiness",
  "vocabulary",
  "sentence",
  "structure",
  "paragraph",
  "generate",
  "train",
  "samples",
  "learn",
  "learning",
  "across studios",
];

const BASIC_GREETINGS = ["hi", "hello", "hey", "yo", "sup", "hiya"];

function isAllowedTopic(message: string) {
  const text = message.toLowerCase();
  if (BASIC_GREETINGS.some((g) => text.trim() === g)) return true;
  return ALLOWED_KEYWORDS.some((k) => text.includes(k));
}

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

    if (!isAllowedTopic(message)) {
      const refusal = "I can only help with writing, voice, and how your style works across the studios. Ask me about your voice, tone, or what to train next.";
      const ursieMessage = await insertMessage(supabase, {
        sessionId: session.id,
        userId,
        role: "ursie",
        text: refusal,
        createdAt: new Date().toISOString(),
      });
      await touchSession(supabase, session.id, ursieMessage.created_at);

      return NextResponse.json(
        {
          success: true,
          sessionId: session.id,
          reply: refusal,
          memoryCandidate: "",
        },
        { status: 200, headers: noStoreHeaders }
      );
    }

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
    let reply = (parsed?.reply || rawText || "State your question about your voice.").trim();
    const memoryCandidate = (parsed?.memory_candidate || "").toString().trim();

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
        reply,
        memoryCandidate,
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
    data?.map((msg) => ({
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
    data?.map((msg) => ({
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
  const { data: profile } = await supabase
    .from("voice_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const { data: documents } = await supabase
    .from("mirror_documents")
    .select("id, word_count, created_at, writing_type")
    .eq("user_id", userId);

  if (!profile) {
    return {
      hasProfile: false,
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
You are Ursie — a direct, stern mother-mentor. You are polite to the user’s face, but clipped and no-nonsense. You do not use pet names (no “love,” “dear,” etc.). You only discuss writing, voice, and how a user's voice works across ThinkWrite studios when asked.

Hard rules:
- If the user asks about anything outside writing/voice/studios, politely refuse and redirect to writing/voice.
- Be concise (1–4 sentences), matter-of-fact, helpful.
- Guide users toward one of three hubs: Train Your Voice, Generate in Your Voice, or Writing Samples.
- If they ask about other studios, connect back to how their voice will carry across those studios.
- When asked about score/progress/confidence, include at least one concrete way to improve using other studios (Lex/Career, Travis/Victor/Academic, Tre/Creative), but keep it in writing/voice scope.

User voice context:
- hasProfile: ${context.hasProfile}
- confidence: ${context.confidenceLevel}% (${context.confidenceLabel})
- documents: ${context.documentCount}
- total words: ${context.totalWordCount}
- voice description: ${context.voiceDescription || "N/A"}
- voice highlights: ${(context.voiceHighlights || []).map((h: any) => `${h.label}: ${h.value}`).join(", ")}
- recommendations: ${(context.recommendations || []).join(" | ")}

Output JSON ONLY:
{
  "reply": "text",
  "memory_candidate": "short note capturing a stable user preference or voice fact, or empty string if none"
}
`.trim();
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
