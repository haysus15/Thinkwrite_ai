import { francAll } from "franc";
import { normalizeLanguageCode } from "@/lib/language/normalizeLanguageCode";

const MINIMUM_DETECTION_LENGTH = 30;

export interface LanguageDetectionResult {
  language: string;
  confidence: number;
  requiresConfirmation: boolean;
  rawCode: string;
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeConfidence(resultSet: Array<[string, number]>): number {
  if (resultSet.length === 0) return 0;

  const [topCode, topScore] = resultSet[0];
  if (!topCode || topCode === "und") return 0;
  if (resultSet.length === 1) return clamp(topScore);

  const [, secondScore] = resultSet[1];
  const normalizedTop = clamp(topScore);
  const margin = Math.max(0, topScore - secondScore) / Math.max(topScore, 0.0001);

  return clamp(normalizedTop * 0.85 + margin * 0.15);
}

export async function detectLanguage(text: string): Promise<LanguageDetectionResult> {
  const sample = String(text || "").trim();

  if (sample.length < MINIMUM_DETECTION_LENGTH) {
    return {
      language: "und",
      confidence: 0,
      requiresConfirmation: true,
      rawCode: "und",
    };
  }

  try {
    const ranked = francAll(sample, { minLength: MINIMUM_DETECTION_LENGTH }) as Array<
      [string, number]
    >;
    const rawCode = ranked[0]?.[0] || "und";
    const { code } = normalizeLanguageCode(rawCode);
    const confidence = rawCode === "und" ? 0 : normalizeConfidence(ranked);

    return {
      language: code || "und",
      confidence,
      requiresConfirmation: confidence < 0.85,
      rawCode,
    };
  } catch {
    return {
      language: "und",
      confidence: 0,
      requiresConfirmation: true,
      rawCode: "error",
    };
  }
}
