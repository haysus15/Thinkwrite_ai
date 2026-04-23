import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
  "Surrogate-Control": "no-store",
};

type EnglishProfileTier = "none" | "emerging" | "developing" | "established";

export async function GET(_request: NextRequest) {
  const { userId, error: authError } = await getAuthUser();
  if (authError || !userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401, headers: noStoreHeaders });
  }

  const supabase = await createSupabaseServerClient();

  const [{ data: userRow, error: userError }, { data: englishProfile, error: englishProfileError }, { count: unreviewedReflections, error: countError }, { data: recentSessions, error: recentError }] =
    await Promise.all([
      supabase
        .from("users")
        .select("bridge_mode_enabled, bridge_mode_source_language, bridge_mode_target_language")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("mirror_language_profiles")
        .select("confidence_tier")
        .eq("user_id", userId)
        .eq("language", "en")
        .maybeSingle(),
      supabase
        .from("bridge_mode_sessions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("reflection_viewed", false)
        .not("ursie_reflection", "is", null),
      supabase
        .from("bridge_mode_sessions")
        .select("id, studio, source_language, created_at, reflection_viewed, ursie_reflection")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  if (userError || englishProfileError || countError || recentError) {
    return NextResponse.json(
      {
        error:
          userError?.message ||
          englishProfileError?.message ||
          countError?.message ||
          recentError?.message ||
          "Failed to load Bridge Mode status",
      },
      { status: 500, headers: noStoreHeaders }
    );
  }

  const englishProfileTier: EnglishProfileTier = (englishProfile?.confidence_tier as EnglishProfileTier | undefined) || "none";

  return NextResponse.json(
    {
      enabled: Boolean(userRow?.bridge_mode_enabled),
      sourceLanguage: userRow?.bridge_mode_source_language || "en",
      targetLanguage: userRow?.bridge_mode_target_language || "en",
      englishProfileTier,
      unreviewedReflections: unreviewedReflections || 0,
      recentSessions: (recentSessions || []).map((session) => ({
        id: session.id,
        studio: session.studio,
        sourceLanguage: session.source_language,
        createdAt: session.created_at,
        reflectionViewed: session.reflection_viewed,
        ursieReflection: session.ursie_reflection,
      })),
    },
    { status: 200, headers: noStoreHeaders }
  );
}
