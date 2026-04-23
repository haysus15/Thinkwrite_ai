import OpenAI from "openai";
import { createSupabaseAdmin } from "@/lib/auth/getAuthUser";
import { extractVoiceFingerprint } from "@/lib/mirror-core/voiceAnalysis";
import { getLanguageConfidenceTier } from "@/lib/language/profile";

type LanguageProfileDocument = {
  id: string;
  language: string | null;
  language_override: string | null;
  file_name: string | null;
  writing_type: string | null;
  created_at: string | null;
  mirror_document_content?:
    | {
        extracted_text: string | null;
      }[]
    | null;
};

const LANGUAGE_DIMENSION_BLOCKS: Record<string, string> = {
  en: "Analyze hedging patterns, passive voice frequency, Oxford comma usage, and em-dash versus parenthetical preference.",
  es: "Analyze pronoun-dropping frequency, subjunctive mood usage rate, ser versus estar distribution, and formal usted versus informal tu register.",
  fr: "Analyze tu versus vous register distribution, negation patterns including dropped ne, and register formality markers.",
  zh: "Analyze topic-comment structure frequency, classical expression preference, and measure word specificity.",
  ja: "Analyze politeness register including plain versus masu/desu ratio and sentence-final particle usage.",
  ko: "Analyze speech level formality distribution and topic particle versus subject particle preference.",
  de: "Analyze compound noun construction tendencies and subordinate clause verb-final frequency.",
  pt: "Analyze Brazilian versus European register signals where detectable and clitic placement patterns.",
  ar: "Analyze Modern Standard Arabic versus dialectal register mixing level.",
};

function getOpenAiClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

function buildLanguageFingerprintPrompt(language: string, samples: string): string {
  const languageBlock =
    LANGUAGE_DIMENSION_BLOCKS[language] ||
    "Apply universal dimensions only. Do not invent unsupported language-specific analysis.";

  return `You are analyzing writing samples to extract a voice fingerprint.
The writing samples are in ${language}.

In addition to universal voice dimensions (sentence length distribution, paragraph structure, formality register, punctuation density, qualifier frequency, structural preferences), analyze the following language-specific dimensions for ${language}:

${languageBlock}

Return valid JSON only. Use this exact schema:
{
  "vocabulary": {
    "uniqueWordCount": number,
    "avgWordLength": number,
    "complexWordRatio": number,
    "contractionRatio": number,
    "topWords": string[],
    "rarityScore": number
  },
  "rhythm": {
    "avgSentenceLength": number,
    "sentenceVariation": number,
    "shortSentenceRatio": number,
    "longSentenceRatio": number,
    "avgParagraphLength": number,
    "paragraphVariation": number
  },
  "punctuation": {
    "exclamationRate": number,
    "questionRate": number,
    "semicolonRate": number,
    "dashRate": number,
    "ellipsisRate": number,
    "colonRate": number,
    "commaRate": number
  },
  "voice": {
    "hedgeDensity": number,
    "qualifierDensity": number,
    "assertiveDensity": number,
    "personalPronounRate": number,
    "formalityScore": number,
    "activeVoiceRatio": number
  },
  "rhetoric": {
    "questionOpenerRate": number,
    "transitionWordRate": number,
    "listUsageRate": number,
    "exampleUsageRate": number,
    "emphasisPatterns": string[]
  },
  "meta": {
    "sampleWordCount": number,
    "sampleSentenceCount": number,
    "extractedAt": string,
    "version": string
  }
}

Writing samples:
"""${samples}"""`;
}

async function extractFingerprintWithGpt(language: string, samples: string) {
  const client = getOpenAiClient();
  if (!client) {
    return extractVoiceFingerprint(samples);
  }

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "user",
        content: buildLanguageFingerprintPrompt(language, samples),
      },
    ],
  });

  const raw = response.choices[0]?.message?.content || "";
  const parsed = JSON.parse(raw);
  return parsed;
}

export async function aggregateLanguageProfile(
  userId: string,
  language: string
): Promise<void> {
  const supabase = createSupabaseAdmin();

  const { data, error } = await supabase
    .from("mirror_documents")
    .select(
      "id, language, language_override, file_name, writing_type, created_at, mirror_document_content(extracted_text)"
    )
    .eq("user_id", userId)
    .eq("excluded_from_profile", false)
    .or(`language.eq.${language},language_override.eq.${language}`)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message || "Failed to load language documents");
  }

  const documents = ((data || []) as unknown) as LanguageProfileDocument[];
  const texts = documents
    .map((document) => document.mirror_document_content?.[0]?.extracted_text?.trim() || "")
    .filter(Boolean);

  if (texts.length === 0) {
    await supabase
      .from("mirror_language_profiles")
      .delete()
      .eq("user_id", userId)
      .eq("language", language);
    return;
  }

  const combinedText = texts.join("\n\n");
  const fingerprint = await extractFingerprintWithGpt(language, combinedText);
  const documentCount = documents.length;
  const confidenceTier = getLanguageConfidenceTier(documentCount);

  const { error: upsertError } = await supabase
    .from("mirror_language_profiles")
    .upsert(
      {
        user_id: userId,
        language,
        fingerprint,
        document_count: documentCount,
        confidence_tier: confidenceTier,
        last_updated: new Date().toISOString(),
      },
      { onConflict: "user_id,language" }
    );

  if (upsertError) {
    throw new Error(upsertError.message || "Failed to upsert language profile");
  }
}
