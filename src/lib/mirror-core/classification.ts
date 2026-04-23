import type { SupabaseClient } from "@supabase/supabase-js";
import { extractVoiceFingerprint } from "@/lib/mirror-core/voiceAnalysis";
import {
  aggregateFingerprints,
  type VoiceProfile,
} from "@/lib/mirror-core/voiceAggregation";
import { mapWritingTypeToChamber, type Chamber } from "@/lib/mirror-core/writingTypes";

export const CLASSIFIABLE_CHAMBERS: Chamber[] = [
  "career",
  "academic",
  "creative",
  "general",
];

type VoiceChamberRow = {
  user_id: string;
  chamber: Chamber | "overall";
  aggregate_fingerprint: VoiceProfile["aggregateFingerprint"];
  confidence_level: number;
  document_count: number;
  total_word_count: number;
  last_trained_at: string;
  evolution_history: VoiceProfile["evolutionHistory"];
  updated_at: string;
};

type MirrorDocumentRow = {
  id: string;
  file_name: string | null;
  writing_type: string | null;
  word_count: number | null;
  training_allowed: boolean | null;
  deleted_at?: string | null;
  visibility_status?: string | null;
  created_at?: string | null;
};

type MirrorDocumentContentRow = {
  document_id: string;
  extracted_text: string | null;
};

function chamberToWritingType(chamber: Chamber): string {
  if (chamber === "career") return "professional";
  return chamber;
}

export function isChamber(value: string | null | undefined): value is Chamber {
  return !!value && CLASSIFIABLE_CHAMBERS.includes(value as Chamber);
}

export function normalizeDomain(input: string): string | null {
  const normalized = String(input || "").trim().toLowerCase();
  if (!normalized || normalized.includes("://") || normalized.includes("/")) {
    return null;
  }

  const hostname = normalized.replace(/^\.+|\.+$/g, "");
  if (!hostname || !/^[a-z0-9.-]+$/.test(hostname) || !hostname.includes(".")) {
    return null;
  }

  return hostname;
}

function rowToProfile(row: {
  user_id: string;
  aggregate_fingerprint: VoiceProfile["aggregateFingerprint"];
  confidence_level: number | null;
  document_count: number | null;
  total_word_count: number | null;
  last_trained_at: string | null;
  evolution_history: VoiceProfile["evolutionHistory"] | null;
} | null): VoiceProfile | null {
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

export async function rebuildVoiceChambersFromDocuments(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const { data: docs, error: docsError } = await supabase
    .from("mirror_documents")
    .select(
      "id, file_name, writing_type, word_count, training_allowed, deleted_at, visibility_status, created_at"
    )
    .eq("user_id", userId)
    .eq("excluded_from_profile", false);

  if (docsError) {
    throw new Error(docsError.message || "Failed to load mirror documents");
  }

  const eligibleDocs = ((docs || []) as MirrorDocumentRow[])
    .filter((doc) => doc.training_allowed !== false)
    .filter(
      (doc) =>
        !doc.deleted_at &&
        doc.visibility_status !== "hidden" &&
        doc.visibility_status !== "purged"
    );

  const docIds = eligibleDocs.map((doc) => doc.id);
  const contentMap = new Map<string, string>();

  if (docIds.length > 0) {
    const { data: contents, error: contentError } = await supabase
      .from("mirror_document_content")
      .select("document_id, extracted_text")
      .in("document_id", docIds);

    if (contentError) {
      throw new Error(contentError.message || "Failed to load mirror document content");
    }

    for (const row of (contents || []) as MirrorDocumentContentRow[]) {
      if (row.document_id && row.extracted_text) {
        contentMap.set(row.document_id, row.extracted_text);
      }
    }
  }

  let overallProfile: VoiceProfile | null = null;
  const chamberProfiles = new Map<Chamber, VoiceProfile | null>();

  for (const doc of eligibleDocs) {
    const text = (contentMap.get(doc.id) || "").trim();
    if (!text) continue;

    const fingerprint = extractVoiceFingerprint(text);
    const wordCount = fingerprint.meta.sampleWordCount || doc.word_count || 0;
    const writingType = doc.writing_type || "general";
    const fileName = doc.file_name || "Mirror Document";

    overallProfile = aggregateFingerprints(overallProfile, fingerprint, doc.id, {
      fileName,
      writingType,
      wordCount,
    });
    overallProfile.userId = userId;

    const chamber = mapWritingTypeToChamber(writingType);
    const chamberProfile = aggregateFingerprints(
      chamberProfiles.get(chamber) || null,
      fingerprint,
      doc.id,
      {
        fileName,
        writingType,
        wordCount,
      }
    );
    chamberProfile.userId = userId;
    chamberProfiles.set(chamber, chamberProfile);
  }

  const { error: deleteError } = await supabase
    .from("voice_chambers")
    .delete()
    .eq("user_id", userId);

  if (deleteError) {
    throw new Error(deleteError.message || "Failed to clear voice chambers");
  }

  const rows: VoiceChamberRow[] = Array.from(chamberProfiles.entries()).flatMap(([chamber, profile]) => {
    if (!profile) return [];
    return [
      {
        user_id: userId,
        chamber,
        aggregate_fingerprint: profile.aggregateFingerprint,
        confidence_level: profile.confidenceLevel,
        document_count: profile.documentCount,
        total_word_count: profile.totalWordCount,
        last_trained_at: profile.lastTrainedAt,
        evolution_history: profile.evolutionHistory,
        updated_at: new Date().toISOString(),
      },
    ];
  });

  if (overallProfile) {
    rows.push({
      user_id: userId,
      chamber: "overall",
      aggregate_fingerprint: overallProfile.aggregateFingerprint,
      confidence_level: overallProfile.confidenceLevel,
      document_count: overallProfile.documentCount,
      total_word_count: overallProfile.totalWordCount,
      last_trained_at: overallProfile.lastTrainedAt,
      evolution_history: overallProfile.evolutionHistory,
      updated_at: new Date().toISOString(),
    });
  }

  if (rows.length > 0) {
    const { error: insertError } = await supabase
      .from("voice_chambers")
      .insert(rows);

    if (insertError) {
      throw new Error(insertError.message || "Failed to rebuild voice chambers");
    }
  }
}

export function getWritingTypeForChamber(chamber: Chamber): string {
  return chamberToWritingType(chamber);
}
