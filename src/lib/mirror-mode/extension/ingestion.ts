import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Chamber } from "@/lib/mirror-mode/writingTypes";
import { aggregateFingerprints, type VoiceProfile } from "@/lib/mirror-mode/voiceAggregation";
import { getConfidenceLabel } from "@/lib/mirror-mode/voiceAggregation";
import type { VoiceFingerprint as InternalVoiceFingerprint } from "@/lib/mirror-mode/voiceAnalysis";
import { SOURCE_AUTHORITY } from "@/lib/mirror-mode/sourceAuthority";

export type ExtensionFingerprint = {
  sessionId: string;
  chamber: Chamber;
  sourceType: "extension";
  capturedAt: string;
  wordCount: number;
  avgSentenceLength: number;
  sentenceLengthVariance: number;
  avgParagraphLength: number;
  shortSentenceRate: number;
  longSentenceRate: number;
  lexicalDensity: number;
  avgWordLength: number;
  contractionRate: number;
  passiveVoiceRate: number;
  hedgeWordRate: number;
  questionRate: number;
  exclamationRate: number;
  emDashRate: number;
  parentheticalRate: number;
  connectorPreferences: {
    additive: number;
    contrastive: number;
    causal: number;
    temporal: number;
  };
  openingPatterns: {
    subjectFirst: number;
    clauseFirst: number;
    conjunctionFirst: number;
    adverbFirst: number;
  };
};

const CHAMBER_TO_WRITING_TYPE: Record<Chamber, string> = {
  career: "professional",
  academic: "academic",
  creative: "creative",
  general: "general",
};

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function rowToProfile(row: any): VoiceProfile | null {
  if (!row) return null;
  return {
    userId: row.user_id,
    aggregateFingerprint: row.aggregate_fingerprint,
    confidenceLevel: row.confidence_level || 0,
    documentCount: row.document_count || 0,
    totalWordCount: row.total_word_count || 0,
    lastTrainedAt: row.last_trained_at || new Date().toISOString(),
    evolutionHistory: row.evolution_history || [],
  };
}

function toInternalFingerprint(fp: ExtensionFingerprint): InternalVoiceFingerprint {
  const sampleSentenceCount = Math.max(1, Math.round(fp.wordCount / Math.max(1, fp.avgSentenceLength)));
  const sampleParagraphCount = Math.max(1, Math.round(sampleSentenceCount / Math.max(1, fp.avgParagraphLength)));

  const estimatedComplexRatio = clamp(((fp.avgWordLength - 4.2) / 6) + fp.longSentenceRate * 0.15);
  const transitionRate = clamp(
    (fp.connectorPreferences.additive +
      fp.connectorPreferences.contrastive +
      fp.connectorPreferences.causal +
      fp.connectorPreferences.temporal) / 4
  );
  const formalityScore = clamp(
    0.55 +
      (estimatedComplexRatio * 0.6) -
      (fp.contractionRate * 1.8) -
      (fp.hedgeWordRate * 1.2) +
      (fp.longSentenceRate * 0.2)
  );

  return {
    vocabulary: {
      uniqueWordCount: Math.max(1, Math.round(fp.lexicalDensity * fp.wordCount)),
      avgWordLength: Number(fp.avgWordLength || 0),
      complexWordRatio: Number(estimatedComplexRatio),
      contractionRatio: Number(clamp(fp.contractionRate)),
      topWords: [],
      rarityScore: Number(clamp(fp.lexicalDensity)),
    },
    rhythm: {
      avgSentenceLength: Number(fp.avgSentenceLength || 0),
      sentenceVariation: Number(fp.sentenceLengthVariance || 0),
      shortSentenceRatio: Number(clamp(fp.shortSentenceRate)),
      longSentenceRatio: Number(clamp(fp.longSentenceRate)),
      avgParagraphLength: Number((fp.avgSentenceLength || 0) * (fp.avgParagraphLength || 0)),
      paragraphVariation: Number(Math.max(0, fp.sentenceLengthVariance * 0.6)),
    },
    punctuation: {
      exclamationRate: Number(clamp(fp.exclamationRate) * 100),
      questionRate: Number(clamp(fp.questionRate) * 100),
      semicolonRate: 0,
      dashRate: Number(clamp(fp.emDashRate) * 100),
      ellipsisRate: 0,
      colonRate: 0,
      commaRate: Number(clamp(fp.parentheticalRate) * 100),
    },
    voice: {
      hedgeDensity: Number(clamp(fp.hedgeWordRate)),
      qualifierDensity: Number(clamp(fp.hedgeWordRate * 0.8)),
      assertiveDensity: Number(clamp((1 - fp.hedgeWordRate) * 0.02)),
      personalPronounRate: Number(clamp(0.02 + fp.openingPatterns.subjectFirst * 0.03)),
      formalityScore: Number(formalityScore),
      activeVoiceRatio: Number(clamp(1 - fp.passiveVoiceRate)),
    },
    rhetoric: {
      questionOpenerRate: Number(clamp(fp.openingPatterns.clauseFirst * fp.questionRate)),
      transitionWordRate: Number(clamp(transitionRate)),
      listUsageRate: 0,
      exampleUsageRate: Number(clamp(fp.connectorPreferences.causal * 0.25)),
      emphasisPatterns: fp.emDashRate > 0 ? ["dash-emphasis"] : [],
    },
    meta: {
      sampleWordCount: fp.wordCount,
      sampleSentenceCount,
      extractedAt: fp.capturedAt || new Date().toISOString(),
      version: "extension-1.0.0",
    },
  };
}

export async function ingestExtensionFingerprint(params: {
  supabase: SupabaseClient;
  userId: string;
  fingerprint: ExtensionFingerprint;
  hostname: string;
}): Promise<{ captured: boolean; chamber: Chamber; confidenceLevel: number; confidenceLabel: string }> {
  const { supabase, userId, fingerprint, hostname } = params;
  const chamber = fingerprint.chamber;
  const internal = toInternalFingerprint(fingerprint);

  const [{ data: overallRow }, { data: chamberRow }] = await Promise.all([
    supabase.from("voice_profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("voice_chambers").select("*").eq("user_id", userId).eq("chamber", chamber).maybeSingle(),
  ]);

  const existingOverall = rowToProfile(overallRow);
  const existingChamber = rowToProfile(chamberRow);

  const documentId = `ext-${fingerprint.sessionId}-${randomUUID()}`;
  const writingType = CHAMBER_TO_WRITING_TYPE[chamber];

  const nextOverall = aggregateFingerprints(existingOverall, internal, documentId, {
    fileName: `Extension capture (${hostname})`,
    writingType,
    wordCount: internal.meta.sampleWordCount,
  });
  nextOverall.userId = userId;

  const nextChamber = aggregateFingerprints(existingChamber, internal, documentId, {
    fileName: `Extension capture (${hostname})`,
    writingType,
    wordCount: internal.meta.sampleWordCount,
  });
  nextChamber.userId = userId;

  await supabase.from("voice_profiles").upsert(
    {
      user_id: userId,
      aggregate_fingerprint: nextOverall.aggregateFingerprint,
      confidence_level: nextOverall.confidenceLevel,
      document_count: nextOverall.documentCount,
      total_word_count: nextOverall.totalWordCount,
      last_trained_at: nextOverall.lastTrainedAt,
      evolution_history: nextOverall.evolutionHistory,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  let { error: chamberError } = await supabase.from("voice_chambers").upsert(
    {
      user_id: userId,
      chamber,
      aggregate_fingerprint: nextChamber.aggregateFingerprint,
      confidence_level: nextChamber.confidenceLevel,
      document_count: nextChamber.documentCount,
      total_word_count: nextChamber.totalWordCount,
      last_trained_at: nextChamber.lastTrainedAt,
      evolution_history: nextChamber.evolutionHistory,
      last_momentum_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,chamber" }
  );

  if (chamberError && String(chamberError.message || "").includes("column")) {
    ({ error: chamberError } = await supabase.from("voice_chambers").upsert(
      {
        user_id: userId,
        chamber,
        aggregate_fingerprint: nextChamber.aggregateFingerprint,
        confidence_level: nextChamber.confidenceLevel,
        document_count: nextChamber.documentCount,
        total_word_count: nextChamber.totalWordCount,
        last_trained_at: nextChamber.lastTrainedAt,
        evolution_history: nextChamber.evolutionHistory,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,chamber" }
    ));
  }

  if (chamberError) {
    throw new Error(chamberError.message);
  }

  await supabase.from("voice_chambers").upsert(
    {
      user_id: userId,
      chamber: "overall",
      aggregate_fingerprint: nextOverall.aggregateFingerprint,
      confidence_level: nextOverall.confidenceLevel,
      document_count: nextOverall.documentCount,
      total_word_count: nextOverall.totalWordCount,
      last_trained_at: nextOverall.lastTrainedAt,
      evolution_history: nextOverall.evolutionHistory,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,chamber" }
  );

  // Best effort event logging for transparency UI.
  const { error: activityError } = await supabase
    .from("mirror_extension_activity")
    .insert({
      user_id: userId,
      hostname,
      chamber,
      session_id: fingerprint.sessionId,
      word_count: fingerprint.wordCount,
      fingerprint,
      captured_at: fingerprint.capturedAt || new Date().toISOString(),
      source_authority: SOURCE_AUTHORITY.EXTENSION_CAPTURED,
    });
  if (activityError) {
    // Ignore missing-table and policy drift here; learning should still succeed.
  }

  return {
    captured: true,
    chamber,
    confidenceLevel: nextOverall.confidenceLevel,
    confidenceLabel: getConfidenceLabel(nextOverall.confidenceLevel),
  };
}
