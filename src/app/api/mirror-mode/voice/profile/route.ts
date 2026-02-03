// src/app/api/mirror-mode/voice/profile/route.ts
// Voice Profile API Route (NO CACHE)

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Errors } from "@/lib/api/errors";
import { describeVoice, type VoiceFingerprint } from "@/lib/mirror-mode/voiceAnalysis";
import { getConfidenceLabel } from "@/lib/mirror-mode/voiceAggregation";

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

export async function GET(req: NextRequest) {
  try {
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) return Errors.unauthorized();

    const { searchParams } = new URL(req.url);
    const includeFingerprint = searchParams.get("includeFingerprint") !== "false";
    const includeEvolution = searchParams.get("includeEvolution") === "true";

    const supabase = await createSupabaseServerClient();

    const { data: profile, error } = await supabase
      .from("voice_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500, headers: noStoreHeaders }
      );
    }

    if (!profile) {
      return NextResponse.json(
        {
          success: true,
          exists: false,
          message: "No voice profile yet. Upload documents to start learning your style.",
          profile: null,
          voiceDescription: null,
          voiceSummary: null,
          fingerprint: null,
        },
        { status: 200, headers: noStoreHeaders }
      );
    }

    const fingerprint = profile.aggregate_fingerprint as VoiceFingerprint;

    const response: any = {
      success: true,
      exists: true,

      profile: {
        userId: profile.user_id,
        confidenceLevel: profile.confidence_level,
        confidenceLabel: getConfidenceLabel(profile.confidence_level),
        documentCount: profile.document_count,
        totalWordCount: profile.total_word_count,
        lastTrainedAt: profile.last_trained_at,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at,
      },

      voiceDescription: describeVoice(fingerprint),
      voiceSummary: buildVoiceSummary(fingerprint),
    };

    if (includeFingerprint) response.fingerprint = fingerprint;
    else response.fingerprint = null;

    if (includeEvolution) response.evolutionHistory = profile.evolution_history || [];

    return NextResponse.json(response, { status: 200, headers: noStoreHeaders });
  } catch (error: any) {
    console.error("[Voice profile GET]:", error?.message);
    // keep your centralized Errors response, but it may not include no-store headers.
    // if you want it to, you can add a variant in Errors helper.
    return NextResponse.json(
      { success: false, error: "Internal error" },
      { status: 500, headers: noStoreHeaders }
    );
  }
}

function buildVoiceSummary(fp: VoiceFingerprint): string {
  const traits: string[] = [];

  if (fp.rhythm.avgSentenceLength > 20) traits.push("prefers longer, flowing sentences");
  else if (fp.rhythm.avgSentenceLength < 12) traits.push("writes in short, punchy sentences");
  else traits.push("uses medium-length sentences");

  if (fp.voice.formalityScore > 0.65) traits.push("formal tone");
  else if (fp.voice.formalityScore < 0.35) traits.push("casual, conversational tone");

  if (fp.vocabulary.contractionRatio > 0.02) traits.push("uses contractions freely");
  else if (fp.vocabulary.contractionRatio < 0.005) traits.push("avoids contractions");

  if (fp.voice.hedgeDensity > 0.015) traits.push("tends to hedge and qualify statements");
  else if (fp.voice.assertiveDensity > 0.008) traits.push("makes confident, direct assertions");

  if (fp.voice.personalPronounRate > 0.04) traits.push("writes with a personal, first-person perspective");

  if (fp.vocabulary.complexWordRatio > 0.18) traits.push("uses sophisticated vocabulary");
  else if (fp.vocabulary.complexWordRatio < 0.08) traits.push("prefers simple, accessible language");

  if (fp.punctuation.dashRate > 4) traits.push("uses dashes for emphasis");
  if (fp.punctuation.questionRate > 8) traits.push("frequently poses questions");
  if (fp.punctuation.exclamationRate > 3) traits.push("uses exclamation marks expressively");

  if (fp.rhetoric.transitionWordRate > 0.15) traits.push("connects ideas with transition words");

  return traits.length ? traits.join("; ") + "." : "Standard, neutral writing style.";
}

export async function DELETE(req: NextRequest) {
  try {
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) return Errors.unauthorized();

    const supabase = await createSupabaseServerClient();

    const { error } = await supabase.from("voice_profiles").delete().eq("user_id", userId);
    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500, headers: noStoreHeaders }
      );
    }

    await supabase.from("mirror_documents").update({ learned_at: null }).eq("user_id", userId);

    return NextResponse.json(
      { success: true, message: "Voice profile deleted. Upload documents to start fresh." },
      { status: 200, headers: noStoreHeaders }
    );
  } catch (error: any) {
    console.error("[Voice profile DELETE]:", error?.message);
    return NextResponse.json(
      { success: false, error: "Internal error" },
      { status: 500, headers: noStoreHeaders }
    );
  }
}
