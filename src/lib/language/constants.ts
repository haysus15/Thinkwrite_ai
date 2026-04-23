export const SUPPORTED_LANGUAGE_OPTIONS = [
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "pt", label: "Portuguese" },
  { code: "zh", label: "Chinese" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "ar", label: "Arabic" },
  { code: "it", label: "Italian" },
] as const;

export type SupportedLanguageCode =
  (typeof SUPPORTED_LANGUAGE_OPTIONS)[number]["code"];

export const SUPPORTED_LANGUAGE_CODES = SUPPORTED_LANGUAGE_OPTIONS.map(
  (language) => language.code
);

export const SUPPORTED_LANGUAGE_CODE_SET = new Set<string>(
  SUPPORTED_LANGUAGE_CODES
);

export const LANGUAGE_LABELS = Object.fromEntries(
  SUPPORTED_LANGUAGE_OPTIONS.map((language) => [language.code, language.label])
) as Record<SupportedLanguageCode, string>;

export function getLanguageLabel(code: string | null | undefined): string {
  if (!code) return "Unknown";
  return (
    SUPPORTED_LANGUAGE_OPTIONS.find((language) => language.code === code)?.label ||
    code.toUpperCase()
  );
}
