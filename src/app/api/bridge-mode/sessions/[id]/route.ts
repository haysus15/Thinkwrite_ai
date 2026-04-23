import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, error: authError } = await getAuthUser();
  if (authError || !userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Session id is required" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("bridge_mode_sessions")
    .select(
      "id, studio, source_language, target_language, source_input, english_output, profile_version, ursie_reflection, reflection_viewed, created_at"
    )
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Bridge session not found" }, { status: 404 });
  }

  return NextResponse.json(
    {
      session: {
        id: data.id,
        studio: data.studio,
        sourceLanguage: data.source_language,
        targetLanguage: data.target_language,
        sourceInput: data.source_input,
        englishOutput: data.english_output,
        profileVersion: data.profile_version,
        ursieReflection: data.ursie_reflection,
        reflectionViewed: data.reflection_viewed,
        createdAt: data.created_at,
      },
    },
    { status: 200 }
  );
}
