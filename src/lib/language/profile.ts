export type LanguageConfidenceTier =
  | "emerging"
  | "developing"
  | "established";

export function getLanguageConfidenceTier(documentCount: number): LanguageConfidenceTier {
  if (documentCount >= 15) return "established";
  if (documentCount >= 5) return "developing";
  return "emerging";
}

export function resolveDocumentLanguage<T extends {
  language_override?: string | null;
  language?: string | null;
}>(document: T): string {
  return document.language_override || document.language || "und";
}
