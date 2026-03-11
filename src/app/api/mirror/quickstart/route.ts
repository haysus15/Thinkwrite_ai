import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { extractVoiceFingerprint } from "@/lib/mirror-mode/voiceAnalysis";
import {
  aggregateFingerprints,
  getConfidenceLabel,
  type VoiceProfile,
} from "@/lib/mirror-mode/voiceAggregation";
import { getChamberStatus } from "@/lib/mirror/voiceProfileStatus";
import { buildVoiceObservations } from "@/lib/mirror/voiceObservations";
import type { Chamber } from "@/lib/mirror-mode/writingTypes";
import { SOURCE_AUTHORITY } from "@/lib/mirror-mode/sourceAuthority";
import { getIngestionWeight } from "@/lib/mirror-mode/ingestionPolicy";

export const runtime = "nodejs";

const CHAMBER_TO_WRITING_TYPE: Record<Chamber, string> = {
  career: "professional",
  academic: "academic",
  creative: "creative",
  general: "general",
};

function isChamber(value: string): value is Chamber {
  return value === "career" || value === "academic" || value === "creative" || value === "general";
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

export async function POST(request: NextRequest) {
  const { userId, error: authError } = await getAuthUser();
  if (authError || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request body." },
      { status: 400 }
    );
  }

  const text = String(body?.text || "").trim();
  const chamber = String(body?.chamber || "");
  if (!isChamber(chamber)) {
    return NextResponse.json(
      { success: false, error: "A valid chamber is required." },
      { status: 400 }
    );
  }
  if (text.length < 100) {
    return NextResponse.json(
      { success: false, error: "Sample must be at least 100 characters." },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const sampleId = randomUUID();
  const writingType = CHAMBER_TO_WRITING_TYPE[chamber];

  const fingerprint = extractVoiceFingerprint(text);
  // Quickstart is weighted below full uploads.
  fingerprint.meta.sampleWordCount = Math.max(
    1,
    Math.round(
      fingerprint.meta.sampleWordCount *
        getIngestionWeight(SOURCE_AUTHORITY.USER_QUICKSTART)
    )
  );

  const [{ data: overallRow }, { data: chamberRow }, { data: onboardingRow }] = await Promise.all([
    supabase.from("voice_profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase
      .from("voice_chambers")
      .select("*")
      .eq("user_id", userId)
      .eq("chamber", chamber)
      .maybeSingle(),
    supabase
      .from("user_profiles")
      .select("quickstart_samples_count")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  const existingOverall = rowToProfile(overallRow);
  const existingChamber = rowToProfile(chamberRow);
  const previousStatus = getChamberStatus(
    existingChamber?.documentCount || 0,
    existingChamber?.confidenceLevel || 0
  );

  const nextOverall = aggregateFingerprints(
    existingOverall,
    fingerprint,
    sampleId,
    {
      fileName: "Quick-start writing sample",
      writingType,
      wordCount: fingerprint.meta.sampleWordCount,
    }
  );
  nextOverall.userId = userId;

  const nextChamber = aggregateFingerprints(existingChamber, fingerprint, sampleId, {
    fileName: "Quick-start writing sample",
    writingType,
    wordCount: fingerprint.meta.sampleWordCount,
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

  let { error: chamberUpsertError } = await supabase
    .from("voice_chambers")
    .upsert(
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
        last_momentum_at: new Date().toISOString(),
      },
      { onConflict: "user_id,chamber" }
    );
  if (chamberUpsertError && String(chamberUpsertError.message || "").includes("column")) {
    ({ error: chamberUpsertError } = await supabase
      .from("voice_chambers")
      .upsert(
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
  if (chamberUpsertError) {
    return NextResponse.json(
      { success: false, error: chamberUpsertError.message },
      { status: 500 }
    );
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

  let { error: onboardingUpsertError } = await supabase.from("user_profiles").upsert(
    {
      user_id: userId,
      mirror_mode_first_visit: false,
      quickstart_samples_count:
        (Number(onboardingRow?.quickstart_samples_count) || 0) + 1,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (
    onboardingUpsertError &&
    String(onboardingUpsertError.message || "").includes("column")
  ) {
    ({ error: onboardingUpsertError } = await supabase
      .from("user_profiles")
      .upsert(
        {
          user_id: userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      ));
  }
  if (onboardingUpsertError) {
    return NextResponse.json(
      { success: false, error: onboardingUpsertError.message },
      { status: 500 }
    );
  }

  const chamberStatus = getChamberStatus(
    nextChamber.documentCount,
    nextChamber.confidenceLevel
  );
  const observations = buildVoiceObservations(nextChamber.aggregateFingerprint);

  return NextResponse.json(
    {
      success: true,
      sampleId,
      observations,
      previousState: previousStatus.state,
      newState: chamberStatus.state,
      stateChanged: previousStatus.state !== chamberStatus.state,
      chamberStatus,
      learning: {
        sourceAuthority: SOURCE_AUTHORITY.USER_QUICKSTART,
        confidenceLevel: nextOverall.confidenceLevel,
        confidenceLabel: getConfidenceLabel(nextOverall.confidenceLevel),
        documentCount: nextOverall.documentCount,
      },
    },
    { status: 200 }
  );
}
