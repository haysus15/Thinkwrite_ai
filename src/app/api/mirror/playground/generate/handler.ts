import { NextRequest, NextResponse } from "next/server.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { VoiceFingerprint } from "@/lib/mirror-core/voiceAnalysis";
import { getConfidenceLabel } from "@/lib/mirror-core/voiceAggregation";
import {
  buildVoiceSystemPrompt,
  buildSubcategoryVoiceGenerationContext,
  getMaxTokens,
  VOICE_GENERATION_CONFIDENCE_THRESHOLD,
} from "@/lib/mirror-core/voiceGeneration";
import { getVoiceReadinessState } from "@/lib/mirror-mode/playgroundVoiceState";

type PlaygroundGenerateBody = {
  session_id?: string;
  chamber?: string;
  audience?: string;
  purpose?: string;
  tone?: string;
  content?: string;
  enrichment?: Record<string, string>;
};

type SessionRow = {
  id: string;
  user_id: string;
  messages: unknown;
  context_memory: Record<string, unknown> | null;
  generation_request: unknown;
  generic_output: string | null;
  voiced_output: string | null;
  chamber: string | null;
  feedback_signals: unknown;
  conversation_onboarding?: boolean;
  confirmation_sent?: boolean;
};

type VoiceChamberRow = {
  chamber: string;
  aggregate_fingerprint: VoiceFingerprint;
  confidence_level: number | null;
  document_count: number | null;
};

type GenerateDeps = {
  resolveUserId: (request: NextRequest) => Promise<string | null>;
  createSupabaseServerClient: () => Promise<SupabaseClient> | SupabaseClient;
  runClaude: (input: { system: string; prompt: string; maxTokens: number }) => Promise<string>;
};

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

function isPlaygroundChamber(value: string | null | undefined): value is "career" | "academic" | "creative" | "general" {
  return value === "career" || value === "academic" || value === "creative" || value === "general";
}

function buildGenericSystemPrompt() {
  return [
    "You are a writing assistant.",
    "Write clear, competent, professional prose.",
    "Do not imitate a personal voice.",
    "Do not add distinctive stylistic markers or personality flourishes.",
    "Deliver only the requested text.",
  ].join(" ");
}

function buildPlaygroundPrompt(body: Required<Pick<PlaygroundGenerateBody, "audience" | "purpose" | "tone" | "content">> & {
  chamber: string;
  enrichment?: Record<string, string>;
}) {
  const enrichmentLines = Object.entries(body.enrichment || {})
    .filter(([, value]) => String(value || "").trim().length > 0)
    .map(([key, value]) => `${key}: ${value}`);

  return [
    `Audience: ${body.audience}`,
    `Purpose: ${body.purpose}`,
    `Tone: ${body.tone}`,
    `Context chamber: ${body.chamber}`,
    `Content to work from: ${body.content}`,
    enrichmentLines.length > 0 ? `Additional context:\n${enrichmentLines.join("\n")}` : "",
    "Write only the final draft.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildLowConfidenceContext(chamber: string, confidenceLevel: number) {
  return `Your ${chamber} voice is still taking shape. I can work with what is there, but it is not sharp yet. Right now I am reading about ${confidenceLevel}% confidence. Give me more real writing and this will tighten.`;
}

function buildMissingChamberContext(chamber: string) {
  return `I do not have your ${chamber} voice yet. I am leaning on the general pattern I already have from you. It will hold for now, but that chamber needs real writing if you want it precise.`;
}

function resolveSessionSubcategoryId(session: SessionRow): string | undefined {
  const generationRequest =
    session.generation_request && typeof session.generation_request === "object"
      ? (session.generation_request as Record<string, unknown>)
      : {};
  if (typeof generationRequest.subcategory_id === "string" && generationRequest.subcategory_id.trim()) {
    return generationRequest.subcategory_id.trim();
  }

  const contextMemory =
    session.context_memory && typeof session.context_memory === "object"
      ? (session.context_memory as Record<string, unknown>)
      : {};
  if (typeof contextMemory.confirmed_subcategory_id === "string" && contextMemory.confirmed_subcategory_id.trim()) {
    return contextMemory.confirmed_subcategory_id.trim();
  }
  if (typeof contextMemory.subcategory_id === "string" && contextMemory.subcategory_id.trim()) {
    return contextMemory.subcategory_id.trim();
  }

  return undefined;
}

function getOnboardingPaths() {
  return {
    upload: {
      label: "Bring me something you already wrote. I can start there.",
      route: "/app/mirror/settings",
    },
    extension: {
      label: "Turn on the extension and let me watch you work in the wild.",
      route: "/app/mirror/settings",
    },
    conversation: {
      label: "Stay here and talk. Give me real language, not placeholders, and I will start learning immediately.",
    },
  };
}

function getUserName(session: SessionRow, enrichment?: Record<string, string>) {
  const contextMemory =
    session.context_memory && typeof session.context_memory === "object"
      ? (session.context_memory as Record<string, unknown>)
      : {};

  const values = [
    enrichment?.user_name,
    typeof contextMemory.user_name === "string" ? contextMemory.user_name : "",
    typeof contextMemory.display_name === "string" ? contextMemory.display_name : "",
  ];

  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim().split(/\s+/)[0];
    }
  }

  return "You";
}

function sentenceCount(text: string): number {
  return text
    .split(/[.!?]+/)
    .map((part) => part.trim())
    .filter(Boolean).length;
}

function isValidConfirmation(text: string, userName: string) {
  const normalized = text.trim();
  if (!normalized) return false;
  if (!normalized.toLowerCase().includes(userName.toLowerCase())) return false;
  if (sentenceCount(normalized) > 3) return false;

  const lower = normalized.toLowerCase();
  return !FORBIDDEN_URSIE_PHRASES.some((phrase) => lower.includes(phrase));
}

function buildConfirmationFallback(
  userName: string,
  body: PlaygroundGenerateBody,
  writingType?: string
) {
  const writingLabel = writingType?.trim() || "draft";
  return `${userName}. You need ${writingLabel} for ${body.audience?.trim()}. ${body.tone?.trim()}. Going now.`;
}

function buildConfirmationPrompt(args: {
  userName: string;
  audience: string;
  purpose: string;
  tone: string;
  writingType?: string;
  content: string;
}) {
  return [
    `User name: ${args.userName}`,
    `Audience: ${args.audience}`,
    `Purpose: ${args.purpose}`,
    `Tone: ${args.tone}`,
    `Writing type: ${args.writingType || "not specified"}`,
    `Conversation content:\n${args.content}`,
    "Write Ursie's confirmation wrap-up before she generates.",
    "1 to 3 sentences maximum.",
    "It is a playback statement, not a question.",
    "Reference what she heard: audience, purpose, writing type, and register if present.",
    "Contain the user's name.",
    "End with a signal that she is moving now.",
    "No forbidden phrases. No apology. No product language.",
    "Output only the confirmation.",
  ].join("\n\n");
}

export async function handleGeneratePlayground(request: NextRequest, deps: GenerateDeps) {
  const userId = await deps.resolveUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as PlaygroundGenerateBody | null;
  if (
    !body?.session_id ||
    !isPlaygroundChamber(body.chamber) ||
    !body.audience?.trim() ||
    !body.purpose?.trim() ||
    !body.tone?.trim() ||
    !body.content?.trim()
  ) {
    return NextResponse.json({ error: "Invalid generation payload" }, { status: 400 });
  }

  const supabase = await deps.createSupabaseServerClient();
  const readiness = await getVoiceReadinessState(userId, supabase);
  const { data: session, error: sessionError } = await supabase
    .from("mirror_playground_sessions")
    .select("*")
    .eq("id", body.session_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (sessionError) {
    return NextResponse.json({ error: sessionError.message }, { status: 500 });
  }
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const resolvedSubcategoryId = resolveSessionSubcategoryId(session as SessionRow);

  if (!readiness.hasAnyData) {
    return NextResponse.json(
      {
        generic_output: null,
        voiced_output: null,
        confidence_context: null,
        zero_captures_state: true,
        onboarding_paths: getOnboardingPaths(),
      },
      { status: 200 }
    );
  }

  const sessionRow = session as SessionRow;
  const confirmationSent = Boolean(sessionRow.confirmation_sent);
  const userName = getUserName(sessionRow, body.enrichment);
  const writingType =
    body.enrichment?.writing_type ||
    (typeof sessionRow.context_memory?.writing_type === "string"
      ? sessionRow.context_memory.writing_type
      : undefined);

  if (!confirmationSent) {
    let confirmation: string | null = null;
    try {
      const generatedConfirmation = await deps.runClaude({
        system: [
          "You are Ursie.",
          "You are direct, precise, unsentimental, and occasionally poetic when precision requires it.",
          "You do not explain yourself.",
          "You do not apologize.",
          "You speak in playback when you are about to move.",
          "Use the user's name at the right moment.",
          "No forbidden phrases or product language.",
        ].join(" "),
        prompt: buildConfirmationPrompt({
          userName,
          audience: body.audience.trim(),
          purpose: body.purpose.trim(),
          tone: body.tone.trim(),
          writingType,
          content: body.content.trim(),
        }),
        maxTokens: getMaxTokens("short"),
      });

      if (isValidConfirmation(generatedConfirmation, userName)) {
        confirmation = generatedConfirmation.trim();
      }
    } catch {
      confirmation = null;
    }

    const { error: confirmationUpdateError } = await supabase
      .from("mirror_playground_sessions")
      .update({
        confirmation_sent: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.session_id)
      .eq("user_id", userId);

    if (confirmationUpdateError) {
      return NextResponse.json({ error: confirmationUpdateError.message }, { status: 500 });
    }

    if (confirmation) {
      return NextResponse.json(
        {
          confirmation,
          ready: false,
        },
        { status: 200 }
      );
    }
  }

  const { data: chamberRow, error: chamberError } = await supabase
    .from("voice_chambers")
    .select("chamber, aggregate_fingerprint, confidence_level, document_count")
    .eq("user_id", userId)
    .eq("chamber", body.chamber)
    .maybeSingle();

  if (chamberError) {
    return NextResponse.json({ error: chamberError.message }, { status: 500 });
  }

  const prompt = buildPlaygroundPrompt({
    audience: body.audience,
    purpose: body.purpose,
    tone: body.tone,
    content: body.content,
    enrichment: body.enrichment,
    chamber: body.chamber,
  });

  const generic_output = await deps.runClaude({
    system: buildGenericSystemPrompt(),
    prompt,
    maxTokens: getMaxTokens("medium"),
  });

  let voiceRow = chamberRow as VoiceChamberRow | null;
  let usedOverallFallback = false;
  if (!voiceRow || (voiceRow.document_count || 0) === 0) {
    const { data: overallRow, error: overallError } = await supabase
      .from("voice_chambers")
      .select("chamber, aggregate_fingerprint, confidence_level, document_count")
      .eq("user_id", userId)
      .eq("chamber", "overall")
      .maybeSingle();

    if (overallError) {
      return NextResponse.json({ error: overallError.message }, { status: 500 });
    }
    if (overallRow) {
      voiceRow = overallRow as VoiceChamberRow;
      usedOverallFallback = true;
    }
  }

  const confidenceLevel = voiceRow?.confidence_level || 0;
  const confidence_context = usedOverallFallback
    ? buildMissingChamberContext(body.chamber)
    : confidenceLevel < VOICE_GENERATION_CONFIDENCE_THRESHOLD
      ? buildLowConfidenceContext(body.chamber, confidenceLevel)
      : null;

  const subcategoryContext = resolvedSubcategoryId
    ? await buildSubcategoryVoiceGenerationContext({
        userId,
        chamber: body.chamber,
        subcategoryId: resolvedSubcategoryId,
        toneOverride: "match",
        supabase,
      })
    : null;

  const voicedSystemPrompt = subcategoryContext
    ? subcategoryContext.systemPrompt
    : voiceRow?.aggregate_fingerprint
    ? buildVoiceSystemPrompt(voiceRow.aggregate_fingerprint, "match")
    : buildGenericSystemPrompt();

  const voiced_output = await deps.runClaude({
    system: voicedSystemPrompt,
    prompt,
    maxTokens: getMaxTokens("medium"),
  });

  const generation_request = {
    audience: body.audience,
    purpose: body.purpose,
    tone: body.tone,
    content: body.content,
    enrichment: body.enrichment || {},
    subcategory_id: resolvedSubcategoryId || null,
    confidence_level: confidenceLevel,
    confidence_label: getConfidenceLabel(confidenceLevel),
  };

  const { error: updateError } = await supabase
    .from("mirror_playground_sessions")
    .update({
      chamber: body.chamber,
      generic_output,
      voiced_output,
      generation_request,
      confirmation_sent: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", body.session_id)
    .eq("user_id", userId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      generic_output,
      voiced_output,
      confidence_context: subcategoryContext?.confidenceContext ?? confidence_context,
      zero_captures_state: false,
      ready: true,
    },
    { status: 200 }
  );
}
