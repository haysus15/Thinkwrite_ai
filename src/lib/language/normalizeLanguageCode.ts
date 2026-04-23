const ISO_639_3_TO_1: Record<string, string> = {
  eng: "en",
  spa: "es",
  fra: "fr",
  fre: "fr",
  cmn: "zh",
  zho: "zh",
  chi: "zh",
  jpn: "ja",
  kor: "ko",
  deu: "de",
  ger: "de",
  por: "pt",
  arb: "ar",
  ara: "ar",
  ita: "it",
};

export interface NormalizedLanguageCode {
  code: string;
  mapped: boolean;
}

export function normalizeLanguageCode(rawCode: string | null | undefined): NormalizedLanguageCode {
  const normalized = String(rawCode || "").trim().toLowerCase();

  if (!normalized || normalized === "und") {
    return { code: "und", mapped: true };
  }

  if (normalized.length === 2) {
    return { code: normalized, mapped: true };
  }

  const mappedCode = ISO_639_3_TO_1[normalized];
  if (mappedCode) {
    return { code: mappedCode, mapped: true };
  }

  return { code: normalized, mapped: false };
}
