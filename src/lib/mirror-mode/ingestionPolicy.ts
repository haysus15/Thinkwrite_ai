import {
  SOURCE_AUTHORITY,
  type SourceAuthority,
} from "@/lib/mirror-mode/sourceAuthority";

export const MINIMUM_WORD_COUNT = 80;
export const QUICKSTART_WORD_COUNT = 40;

export const INGESTION_WEIGHTS: Record<SourceAuthority, number> = {
  [SOURCE_AUTHORITY.USER_UPLOADED]: 1.0,
  [SOURCE_AUTHORITY.USER_TYPED]: 1.0,
  [SOURCE_AUTHORITY.EXTENSION_CAPTURED]: 0.8,
  [SOURCE_AUTHORITY.USER_QUICKSTART]: 0.4,
  [SOURCE_AUTHORITY.AI_GENERATED_ACCEPTED]: 0.0,
  [SOURCE_AUTHORITY.AI_GENERATED_REJECTED]: 0.0,
  [SOURCE_AUTHORITY.UNKNOWN]: 0.0,
};

export function getIngestionWeight(sourceAuthority: SourceAuthority): number {
  return INGESTION_WEIGHTS[sourceAuthority] ?? 0;
}

export function shouldIngestForProfile(
  wordCount: number,
  sourceAuthority: SourceAuthority
): { eligible: boolean; reason: string } {
  const weight = getIngestionWeight(sourceAuthority);
  if (weight === 0) {
    return {
      eligible: false,
      reason: `Source '${sourceAuthority}' is excluded from voice profile training`,
    };
  }

  const threshold =
    sourceAuthority === SOURCE_AUTHORITY.USER_QUICKSTART
      ? QUICKSTART_WORD_COUNT
      : MINIMUM_WORD_COUNT;

  if (wordCount < threshold) {
    return {
      eligible: false,
      reason: `Word count ${wordCount} is below minimum threshold of ${threshold}`,
    };
  }

  return { eligible: true, reason: "Eligible for voice profile training" };
}

export function getRetentionLabel(
  sourceAuthority: SourceAuthority,
  eligible: boolean
): string {
  if (sourceAuthority === SOURCE_AUTHORITY.EXTENSION_CAPTURED) {
    return "Pattern data only — no text stored";
  }
  if (!eligible) {
    return "Stored — not used for voice learning";
  }
  return "Used for voice learning";
}

export function getSourceLabel(
  sourceAuthority: SourceAuthority,
  hostname?: string
): string {
  const labels: Record<SourceAuthority, string> = {
    [SOURCE_AUTHORITY.USER_TYPED]: "Typed in studio",
    [SOURCE_AUTHORITY.USER_UPLOADED]: "Uploaded document",
    [SOURCE_AUTHORITY.USER_QUICKSTART]: "Quick-start sample",
    [SOURCE_AUTHORITY.AI_GENERATED_ACCEPTED]: "AI-generated content",
    [SOURCE_AUTHORITY.AI_GENERATED_REJECTED]: "AI suggestion — not used",
    [SOURCE_AUTHORITY.EXTENSION_CAPTURED]: hostname
      ? `Written on ${hostname}`
      : "Browser extension",
    [SOURCE_AUTHORITY.UNKNOWN]: "Unknown source",
  };
  return labels[sourceAuthority] ?? "Unknown source";
}
