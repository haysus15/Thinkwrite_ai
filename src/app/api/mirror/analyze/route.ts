import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { extractVoiceFingerprint } from "@/lib/mirror-mode/voiceAnalysis";
import { getChamberStatus } from "@/lib/mirror/voiceProfileStatus";
import { buildVoiceObservations } from "@/lib/mirror/voiceObservations";
import type { Chamber } from "@/lib/mirror-mode/writingTypes";
import { QUICKSTART_WORD_COUNT } from "@/lib/mirror-mode/ingestionPolicy";

export const runtime = "nodejs";

function isChamber(value: string): value is Chamber {
  return value === "career" || value === "academic" || value === "creative" || value === "general";
}

export async function POST(request: NextRequest) {
  const { userId, error: authError } = await getAuthUser();
  if (authError || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request body." },
      { status: 400 }
    );
  }

  const text = String(body?.text || "").trim();
  const chamber = String(body?.chamber || "general");
  if (!isChamber(chamber)) {
    return NextResponse.json(
      { success: false, error: "A valid chamber is required." },
      { status: 400 }
    );
  }
  if (text.length < QUICKSTART_WORD_COUNT) {
    return NextResponse.json(
      { success: false, error: "Sample is too short to analyze." },
      { status: 400 }
    );
  }

  const fingerprint = extractVoiceFingerprint(text);
  const observations = buildVoiceObservations(fingerprint);

  const supabase = await createSupabaseServerClient();
  const { data: chamberRow } = await supabase
    .from("voice_chambers")
    .select("confidence_level, document_count")
    .eq("user_id", userId)
    .eq("chamber", chamber)
    .maybeSingle();

  const previousStatus = getChamberStatus(
    chamberRow?.document_count || 0,
    chamberRow?.confidence_level || 0
  );
  const estimatedStatus = getChamberStatus(
    (chamberRow?.document_count || 0) + 1,
    Math.min(100, (chamberRow?.confidence_level || 0) + 8)
  );

  return NextResponse.json(
    {
      success: true,
      observations,
      previousState: previousStatus.state,
      newState: estimatedStatus.state,
      stateChanged: previousStatus.state !== estimatedStatus.state,
      chamberStatus: estimatedStatus,
    },
    { status: 200 }
  );
}
