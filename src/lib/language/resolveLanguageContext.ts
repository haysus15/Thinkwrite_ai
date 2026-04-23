import { createSupabaseAdmin } from "@/lib/auth/getAuthUser";
import { detectLanguage } from "@/lib/language/detectLanguage";
import {
  getLanguageLabel,
  SUPPORTED_LANGUAGE_CODE_SET,
} from "@/lib/language/constants";

export interface LanguageContext {
  inputLanguage: string;
  outputLanguage: string;
  isCrossLanguage: boolean;
  profileVersion: 1 | 2 | null;
  fingerprint: object | null;
  confidenceTier: "emerging" | "developing" | "established" | null;
}

function normalizeRequestedLanguage(language: string | null | undefined): string | null {
  const value = String(language || "").trim().toLowerCase();
  if (!value) return null;
  return SUPPORTED_LANGUAGE_CODE_SET.has(value) ? value : null;
}

export async function resolveLanguageContext(input: {
  userId: string;
  inputText: string;
  requestedOutputLanguage?: string | null;
}): Promise<LanguageContext> {
  const detection = await detectLanguage(input.inputText || "");
  const requestedOutputLanguage = normalizeRequestedLanguage(
    input.requestedOutputLanguage
  );

  const inputLanguage =
    detection.language && detection.language !== "und"
      ? detection.language
      : requestedOutputLanguage || "en";
  const outputLanguage = requestedOutputLanguage || inputLanguage;
  const isCrossLanguage = inputLanguage !== outputLanguage;

  const supabase = createSupabaseAdmin();
  const { data: profile } = await supabase
    .from("mirror_language_profiles")
    .select("fingerprint, confidence_tier")
    .eq("user_id", input.userId)
    .eq("language", outputLanguage)
    .maybeSingle();

  if (!profile) {
    return {
      inputLanguage,
      outputLanguage,
      isCrossLanguage,
      profileVersion: isCrossLanguage ? 2 : null,
      fingerprint: null,
      confidenceTier: null,
    };
  }

  const confidenceTier = profile.confidence_tier as
    | "emerging"
    | "developing"
    | "established";

  if (isCrossLanguage && confidenceTier !== "developing" && confidenceTier !== "established") {
    return {
      inputLanguage,
      outputLanguage,
      isCrossLanguage,
      profileVersion: 2,
      fingerprint: null,
      confidenceTier,
    };
  }

  return {
    inputLanguage,
    outputLanguage,
    isCrossLanguage,
    profileVersion: profile.fingerprint ? (isCrossLanguage ? 1 : null) : null,
    fingerprint: profile.fingerprint || null,
    confidenceTier,
  };
}

export function buildLanguageInstruction(outputLanguage: string): string {
  return `Conduct this entire session in ${outputLanguage}.
All responses, questions, feedback, and generated content must be in ${outputLanguage}.
The persona and character remain unchanged. Only the language changes.`;
}

export function buildCrossLanguageNotice(languageContext: LanguageContext): string | null {
  if (!languageContext.isCrossLanguage) return null;

  const source = getLanguageLabel(languageContext.inputLanguage);
  const target = getLanguageLabel(languageContext.outputLanguage);

  if (languageContext.profileVersion === 1) {
    return `Writing in ${source} -> ${target}. Applying your ${target} voice profile.`;
  }

  return `Writing in ${source} -> ${target}. Transferring your voice characteristics - add ${target} writing samples to improve accuracy.`;
}
