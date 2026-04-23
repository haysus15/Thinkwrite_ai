// src/app/api/mirror-mode/voice/status/route.ts
// Dashboard endpoint - shows learning progress and voice readiness (NO CACHE)

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { describeVoice, type VoiceFingerprint } from "@/lib/mirror-core/voiceAnalysis";
import { getConfidenceLabel } from "@/lib/mirror-core/voiceAggregation";
import { getChamberStatus } from "@/lib/mirror/voiceProfileStatus";

export const runtime = "nodejs";

// 🚫 prevent Next/Vercel caching
export const dynamic = "force-dynamic";
export const revalidate = 0;

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
  "Surrogate-Control": "no-store",
};

type MirrorDocumentRow = {
  id: string;
  file_name: string;
  word_count: number;
  file_size: number | null;
  learned_at: string | null;
  created_at: string;
  writing_type: string | null;
  visibility_status?: string | null;
  deleted_at?: string | null;
};

type ChamberKey = "career" | "academic" | "creative" | "general" | "overall";
type ChamberSummary = {
  confidenceLabel: string;
  confidenceLevel: number;
  documentCount: number;
  lastTrainedAt: string | null;
  updatedAt: string | null;
};
type ChamberWarning = {
  chamber: ChamberKey;
  message: string;
  documentCount: number;
  minimum: number;
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const includeFullHistory = searchParams.get("fullHistory") === "true";

    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401, headers: noStoreHeaders }
      );
    }

    const supabase = await createSupabaseServerClient();
    const { data: onboarding } = await supabase
      .from("user_profiles")
      .select(
        "mirror_mode_first_visit, quickstart_samples_count, mirror_roadmap_dismissed"
      )
      .eq("user_id", userId)
      .maybeSingle();

    // ---- FETCH VOICE PROFILE ----
    const { data: profile, error: profileError } = await supabase
      .from("voice_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json(
        { success: false, error: profileError.message },
        { status: 500, headers: noStoreHeaders }
      );
    }

    // ---- FETCH DOCUMENT STATS ----
    const { data: documents, error: docsError } = await supabase
      .from("mirror_documents")
      .select("id, file_name, word_count, file_size, learned_at, created_at, writing_type, visibility_status, deleted_at")
      .eq("user_id", userId)
      .eq("visibility_status", "active")
      .order("created_at", { ascending: false });

    if (docsError) {
      return NextResponse.json(
        { success: false, error: docsError.message },
        { status: 500, headers: noStoreHeaders }
      );
    }

    const normalizedDocuments = (documents || []) as MirrorDocumentRow[];

    const totalDocuments = normalizedDocuments.length || 0;
    const learnedDocuments = normalizedDocuments.filter((d) => d.learned_at).length || 0;
    const pendingDocuments = totalDocuments - learnedDocuments;

    // ---- FETCH CHAMBER SUMMARIES (BEST EFFORT) ----
    let chamberSummaries: Record<ChamberKey, ChamberSummary | null> | null = null;
    let chamberWarnings: ChamberWarning[] = [];
    try {
      const { data: chamberRows } = await supabase
        .from("voice_chambers")
        .select("chamber, confidence_level, document_count, last_trained_at, updated_at")
        .eq("user_id", userId)
        .in("chamber", ["career", "academic", "creative", "general", "overall"]);

      const byChamber: Partial<Record<ChamberKey, ChamberSummary>> = {};
      (chamberRows || []).forEach((row) => {
        const chamber = row.chamber as ChamberKey;
        byChamber[chamber] = {
          confidenceLabel: getConfidenceLabel(row.confidence_level || 0),
          confidenceLevel: row.confidence_level || 0,
          documentCount: row.document_count || 0,
          lastTrainedAt: row.last_trained_at || null,
          updatedAt: row.updated_at || null,
        };
      });

      chamberSummaries = {
        career: byChamber.career || null,
        academic: byChamber.academic || null,
        creative: byChamber.creative || null,
        general: byChamber.general || null,
        overall: byChamber.overall || null,
      };

      const minDocs = 3;
      const chambersToCheck: ChamberKey[] = [
        "career",
        "academic",
        "creative",
        "general",
      ];
      chamberWarnings = chambersToCheck
        .map((key) => {
          const count = chamberSummaries?.[key]?.documentCount || 0;
          if (count >= minDocs) return null;
          return {
            chamber: key,
            message: `${key} chamber needs at least ${minDocs} documents for reliable voice capture.`,
            documentCount: count,
            minimum: minDocs,
          };
        })
        .filter((item): item is ChamberWarning => item !== null);
    } catch {
      chamberSummaries = null;
      chamberWarnings = [];
    }

    // No profile yet
    if (!profile) {
      const chamberStatuses = {
        career: getChamberStatus(0, 0),
        academic: getChamberStatus(0, 0),
        creative: getChamberStatus(0, 0),
        general: getChamberStatus(0, 0),
      };
      return NextResponse.json(
        {
          success: true,
          status: "not_started",

          overview: {
            hasProfile: false,
            confidenceLevel: 0,
            confidenceLabel: "Not Started",
            documentCount: 0,
            totalWordCount: 0,
            lastTrainedAt: null,
          },

          documents: {
            total: totalDocuments,
            learned: learnedDocuments,
            pending: pendingDocuments,
            recentUploads:
              normalizedDocuments.slice(0, 200).map((d) => ({
                id: d.id,
                fileName: d.file_name,
                wordCount: d.word_count,
                fileSize: d.file_size || 0,
                learned: !!d.learned_at,
                writingType: d.writing_type,
                uploadedAt: d.created_at,
              })) || [],
          },

          voiceDescription: null,
          voiceHighlights: null,

          recommendations: [
            "Upload your first document to start learning your voice",
            "Include a variety of writing samples for best results",
            "Aim for at least 3–5 documents with 500+ words each",
          ],
          chamberStatuses,
          preferences: {
            isFirstMirrorModeVisit: onboarding?.mirror_mode_first_visit !== false,
            quickstartSamplesCount: onboarding?.quickstart_samples_count || 0,
            roadmapDismissedByChamber:
              onboarding?.mirror_roadmap_dismissed || null,
          },
        },
        { status: 200, headers: noStoreHeaders }
      );
    }

    // ---- HAS PROFILE - BUILD FULL STATUS ----
    const fingerprint = profile.aggregate_fingerprint as VoiceFingerprint;
    const confidenceLevel = profile.confidence_level || 0;
    const confidenceLabel = getConfidenceLabel(confidenceLevel);

    const nextMilestone = getNextMilestone(confidenceLevel);
    const voiceHighlights = getVoiceHighlights(fingerprint);

    // Return full history or just recent entries based on query param
    const evolutionHistory = profile.evolution_history || [];
    const evolutionData = includeFullHistory
      ? evolutionHistory
      : evolutionHistory.slice(-10).reverse();

    const chamberStatuses = {
      career: getChamberStatus(
        chamberSummaries?.career?.documentCount || 0,
        chamberSummaries?.career?.confidenceLevel || 0
      ),
      academic: getChamberStatus(
        chamberSummaries?.academic?.documentCount || 0,
        chamberSummaries?.academic?.confidenceLevel || 0
      ),
      creative: getChamberStatus(
        chamberSummaries?.creative?.documentCount || 0,
        chamberSummaries?.creative?.confidenceLevel || 0
      ),
      general: getChamberStatus(
        chamberSummaries?.general?.documentCount || 0,
        chamberSummaries?.general?.confidenceLevel || 0
      ),
    };

    return NextResponse.json(
      {
        success: true,
        status: confidenceLevel >= 65 ? "ready" : "learning",

        overview: {
          hasProfile: true,
          confidenceLevel,
          confidenceLabel,
          documentCount: profile.document_count,
          totalWordCount: profile.total_word_count,
          lastTrainedAt: profile.last_trained_at,
          createdAt: profile.created_at,
          updatedAt: profile.updated_at,
        },

        progress: {
          current: confidenceLevel,
          nextMilestone: nextMilestone.target,
          nextMilestoneLabel: nextMilestone.label,
          documentsNeeded: nextMilestone.documentsNeeded,
          wordsNeeded: nextMilestone.wordsNeeded,
        },

        documents: {
          total: totalDocuments,
          learned: learnedDocuments,
          pending: pendingDocuments,
            recentUploads:
              normalizedDocuments.slice(0, 200).map((d) => ({
              id: d.id,
              fileName: d.file_name,
              wordCount: d.word_count,
              fileSize: d.file_size || 0,
              learned: !!d.learned_at,
              writingType: d.writing_type,
              uploadedAt: d.created_at,
            })) || [],
        },

        voiceDescription: describeVoice(fingerprint),
        voiceHighlights,

        // Full evolution data with all fields for timeline
        evolutionHistory: evolutionData.map((e: any) => ({
          timestamp: e.timestamp,
          documentId: e.documentId,
          documentName: e.documentName || 'Unknown',
          writingType: e.writingType || 'other',
          changesMade: e.changesMade || [],
          confidenceDelta: e.confidenceDelta || 0,
          confidenceLevel: e.confidenceLevel || 0,
          totalWordCount: e.totalWordCount || 0,
          totalDocuments: e.totalDocuments || 0,
        })),

        chamberSummaries,
        chamberStatuses,
        chamberWarnings,
        recommendations: getRecommendations(
          confidenceLevel,
          fingerprint,
          normalizedDocuments
        ),
        preferences: {
          isFirstMirrorModeVisit: onboarding?.mirror_mode_first_visit !== false,
          quickstartSamplesCount: onboarding?.quickstart_samples_count || 0,
          roadmapDismissedByChamber: onboarding?.mirror_roadmap_dismissed || null,
        },
      },
      { status: 200, headers: noStoreHeaders }
    );
  } catch (error: any) {
    console.error("Voice status error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to fetch status" },
      { status: 500, headers: noStoreHeaders }
    );
  }
}

function getNextMilestone(current: number): {
  target: number;
  label: string;
  documentsNeeded: number;
  wordsNeeded: number;
} {
  const milestones = [
    { target: 25, label: "Learning", documentsNeeded: 1, wordsNeeded: 500 },
    { target: 45, label: "Developing", documentsNeeded: 3, wordsNeeded: 2000 },
    { target: 65, label: "Confident", documentsNeeded: 5, wordsNeeded: 5000 },
    { target: 85, label: "Mastered", documentsNeeded: 8, wordsNeeded: 10000 },
    { target: 100, label: "Complete", documentsNeeded: 12, wordsNeeded: 15000 },
  ];

  for (const milestone of milestones) {
    if (current < milestone.target) return milestone;
  }
  return milestones[milestones.length - 1];
}

function getVoiceHighlights(fp: VoiceFingerprint): {
  label: string;
  value: string;
}[] {
  const highlights: { label: string; value: string }[] = [];

  if (fp.voice.formalityScore > 0.65) {
    highlights.push({ label: "Tone", value: "Formal & Professional" });
  } else if (fp.voice.formalityScore < 0.35) {
    highlights.push({ label: "Tone", value: "Casual & Friendly" });
  } else {
    highlights.push({ label: "Tone", value: "Balanced" });
  }

  if (fp.rhythm.avgSentenceLength > 18) {
    highlights.push({ label: "Sentences", value: "Longer & Flowing" });
  } else if (fp.rhythm.avgSentenceLength < 12) {
    highlights.push({ label: "Sentences", value: "Short & Punchy" });
  } else {
    highlights.push({ label: "Sentences", value: "Medium Length" });
  }

  if (fp.vocabulary.complexWordRatio > 0.15) {
    highlights.push({ label: "Vocabulary", value: "Sophisticated" });
  } else if (fp.vocabulary.complexWordRatio < 0.08) {
    highlights.push({ label: "Vocabulary", value: "Accessible" });
  } else {
    highlights.push({ label: "Vocabulary", value: "Moderate" });
  }

  if (fp.voice.assertiveDensity > 0.008) {
    highlights.push({ label: "Style", value: "Confident & Direct" });
  } else if (fp.voice.hedgeDensity > 0.015) {
    highlights.push({ label: "Style", value: "Thoughtful & Nuanced" });
  }

  if (fp.voice.personalPronounRate > 0.04) {
    highlights.push({ label: "Perspective", value: "Personal & First-Person" });
  }

  return highlights.slice(0, 5);
}

function getRecommendations(confidence: number, fp: VoiceFingerprint, documents: any[]): string[] {
  const recommendations: string[] = [];

  if (confidence < 25) {
    recommendations.push("Upload more documents — aim for at least 3 diverse samples");
  } else if (confidence < 45) {
    recommendations.push("Your voice is forming! Add more samples to strengthen the pattern");
  } else if (confidence < 65) {
    recommendations.push("Good progress! A few more documents will make your voice reliable");
  }

  const totalWords = fp?.meta?.sampleWordCount ?? 0;
  if (totalWords < 2000) {
    recommendations.push("Include longer documents for better pattern recognition");
  }

  const writingTypes = new Set(documents.map((d) => d.writing_type).filter(Boolean));
  if (writingTypes.size < 2 && documents.length >= 3) {
    recommendations.push("Upload different types of writing for a more complete voice profile");
  }

  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const recentDocs = documents.filter((d) => new Date(d.created_at).getTime() > dayAgo);
  if (recentDocs.length === 0 && confidence < 85) {
    recommendations.push("Upload a new document to continue improving your voice profile");
  }

  return recommendations.slice(0, 3);
}
