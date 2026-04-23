export const LOCALES = ["en", "es", "fr", "de", "pt", "zh", "ja", "ko"] as const;

export type AppLocale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "en";

export const LOCALE_COOKIE_NAME = "NEXT_LOCALE";

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return Boolean(value && LOCALES.includes(value as AppLocale));
}

export function resolveBrowserLocale(headerValue: string | null | undefined): AppLocale {
  const raw = String(headerValue || "").toLowerCase();
  if (!raw) return DEFAULT_LOCALE;

  const candidates = raw
    .split(",")
    .map((part) => part.trim().split(";")[0])
    .filter(Boolean);

  for (const candidate of candidates) {
    const base = candidate.split("-")[0];
    if (isAppLocale(base)) {
      return base;
    }
  }

  return DEFAULT_LOCALE;
}
