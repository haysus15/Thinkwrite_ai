import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Errors } from "@/lib/api/errors";
import { extractVoiceFingerprint, type VoiceFingerprint } from "@/lib/mirror-mode/voiceAnalysis";
import { aggregateFingerprints, type VoiceProfile } from "@/lib/mirror-mode/voiceAggregation";
import { mapWritingTypeToChamber } from "@/lib/mirror-mode/writingTypes";
import { MINIMUM_WORD_COUNT } from "@/lib/mirror-mode/ingestionPolicy";

export const runtime = "nodejs";

type MirrorDoc = {
  id: string;
  file_name?: string | null;
  writing_type?: string | null;
  word_count?: number | null;
  training_allowed?: boolean | null;
  deleted_at?: string | null;
  visibility_status?: string | null;
  created_at?: string | null;
};

function createEmptyFingerprint(): VoiceFingerprint {
  const now = new Date().toISOString();
  return {
    vocabulary: {
      uniqueWordCount: 0,
      avgWordLength: 0,
      complexWordRatio: 0,
      contractionRatio: 0,
      topWords: [],
      rarityScore: 0,
    },
    rhythm: {
      avgSentenceLength: 0,
      sentenceVariation: 0,
      shortSentenceRatio: 0,
      longSentenceRatio: 0,
      avgParagraphLength: 0,
      paragraphVariation: 0,
    },
    punctuation: {
      exclamationRate: 0,
      questionRate: 0,
      semicolonRate: 0,
      dashRate: 0,
      ellipsisRate: 0,
      colonRate: 0,
      commaRate: 0,
    },
    voice: {
      hedgeDensity: 0,
      qualifierDensity: 0,
      assertiveDensity: 0,
      personalPronounRate: 0,
      formalityScore: 0,
      activeVoiceRatio: 0,
    },
    rhetoric: {
      questionOpenerRate: 0,
      transitionWordRate: 0,
      listUsageRate: 0,
      exampleUsageRate: 0,
      emphasisPatterns: [],
    },
    meta: {
      sampleWordCount: 0,
      sampleSentenceCount: 0,
      extractedAt: now,
      version: "1.0.0",
    },
  };
}

async function loadMirrorDocs(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, userId: string) {
  const primary = await supabase
    .from("mirror_documents")
    .select("id, file_name, writing_type, word_count, training_allowed, deleted_at, visibility_status, created_at")
    .eq("user_id", userId)
    .eq("excluded_from_profile", false);

  if (!primary.error) {
    return (primary.data || []) as MirrorDoc[];
  }

  const fallback = await supabase
    .from("mirror_documents")
    .select("id, file_name, writing_type, word_count, training_allowed, created_at")
    .eq("user_id", userId);

  if (fallback.error) {
    throw new Error(fallback.error.message || "Failed to fetch mirror documents");
  }

  return (fallback.data || []) as MirrorDoc[];
}

export async function POST(req: NextRequest) {
  try {
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) return Errors.unauthorized();

    const body = await req.json().catch(() => ({}));
    const includeHidden = Boolean(body?.includeHidden);
    const minWords = Number.isFinite(body?.minWords)
      ? Math.max(1, Number(body.minWords))
      : MINIMUM_WORD_COUNT;

    const supabase = await createSupabaseServerClient();
    const docs = await loadMirrorDocs(supabase, userId);

    const eligibleDocs = docs
      .filter((doc) => doc.training_allowed !== false)
      .filter((doc) => includeHidden || (!doc.deleted_at && doc.visibility_status !== "hidden" && doc.visibility_status !== "purged"))
      .sort((a, b) => {
        const at = new Date(a.created_at || 0).getTime();
        const bt = new Date(b.created_at || 0).getTime();
        return at - bt;
      });

    const docIds = eligibleDocs.map((d) => d.id);

    const contentMap = new Map<string, string>();
    if (docIds.length > 0) {
      const { data: contents, error: contentError } = await supabase
        .from("mirror_document_content")
        .select("document_id, extracted_text")
        .in("document_id", docIds);

      if (contentError) {
        return NextResponse.json(
          { success: false, error: contentError.message || "Failed to fetch document content" },
          { status: 500 }
        );
      }

      for (const row of contents || []) {
        if (row.document_id && typeof row.extracted_text === "string") {
          contentMap.set(row.document_id, row.extracted_text);
        }
      }
    }

    let overallProfile: VoiceProfile | null = null;
    const chamberProfiles = new Map<string, VoiceProfile | null>();
    let learnedFrom = 0;

    for (const doc of eligibleDocs) {
      const text = (contentMap.get(doc.id) || "").trim();
      if (!text) continue;

      const rawWords = text.split(/\s+/).filter(Boolean).length;
      if (rawWords < minWords) continue;

      const writingType = doc.writing_type || "general";
      const fileName = doc.file_name || "Mirror Document";
      const fingerprint = extractVoiceFingerprint(text);
      const wordCount = fingerprint.meta.sampleWordCount || rawWords;

      overallProfile = aggregateFingerprints(overallProfile, fingerprint, doc.id, {
        fileName,
        writingType,
        wordCount,
      });
      overallProfile.userId = userId;

      const chamber = mapWritingTypeToChamber(writingType);
      const currentChamberProfile = chamberProfiles.get(chamber) || null;
      const nextChamberProfile = aggregateFingerprints(currentChamberProfile, fingerprint, doc.id, {
        fileName,
        writingType,
        wordCount,
      });
      nextChamberProfile.userId = userId;
      chamberProfiles.set(chamber, nextChamberProfile);

      learnedFrom += 1;
    }

    if (!overallProfile) {
      const now = new Date().toISOString();
      const emptyFingerprint = createEmptyFingerprint();
      const { error: upsertEmptyError } = await supabase
        .from("voice_profiles")
        .upsert(
          {
            user_id: userId,
            aggregate_fingerprint: emptyFingerprint,
            confidence_level: 0,
            document_count: 0,
            total_word_count: 0,
            last_trained_at: null,
            evolution_history: [],
            updated_at: now,
          },
          { onConflict: "user_id" }
        );

      if (upsertEmptyError) {
        return NextResponse.json(
          { success: false, error: upsertEmptyError.message || "Failed to reset voice profile" },
          { status: 500 }
        );
      }

      try {
        await supabase.from("voice_chambers").delete().eq("user_id", userId);
      } catch {
        // best effort
      }

      return NextResponse.json({
        success: true,
        rebuilt: true,
        documents_scanned: eligibleDocs.length,
        documents_learned: 0,
        profile: {
          confidenceLevel: 0,
          documentCount: 0,
          totalWordCount: 0,
        },
      });
    }

    const { error: upsertProfileError } = await supabase
      .from("voice_profiles")
      .upsert(
        {
          user_id: userId,
          aggregate_fingerprint: overallProfile.aggregateFingerprint,
          confidence_level: overallProfile.confidenceLevel,
          document_count: overallProfile.documentCount,
          total_word_count: overallProfile.totalWordCount,
          last_trained_at: overallProfile.lastTrainedAt,
          evolution_history: overallProfile.evolutionHistory,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (upsertProfileError) {
      return NextResponse.json(
        { success: false, error: upsertProfileError.message || "Failed to save rebuilt profile" },
        { status: 500 }
      );
    }

    try {
      await supabase.from("voice_chambers").delete().eq("user_id", userId);

      const chamberRows = Array.from(chamberProfiles.entries()).flatMap(([chamber, profile]) => {
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

      chamberRows.push({
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

      if (chamberRows.length > 0) {
        await supabase.from("voice_chambers").insert(chamberRows);
      }
    } catch {
      // best effort; overall profile already rebuilt
    }

    return NextResponse.json({
      success: true,
      rebuilt: true,
      documents_scanned: eligibleDocs.length,
      documents_learned: learnedFrom,
      profile: {
        confidenceLevel: overallProfile.confidenceLevel,
        documentCount: overallProfile.documentCount,
        totalWordCount: overallProfile.totalWordCount,
      },
    });
  } catch (error: any) {
    console.error("[Mirror Mode voice rebuild]:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
