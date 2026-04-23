import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateBridgeReflection } from "@/lib/bridge/generateBridgeReflection";

export async function POST(
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
      "id, user_id, source_input, english_output, source_language, profile_version"
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

  if (
    typeof data.source_input === "string" &&
    typeof data.english_output === "string" &&
    typeof data.source_language === "string" &&
    (data.profile_version === 1 || data.profile_version === 2)
  ) {
    void generateBridgeReflection(
      data.id,
      data.user_id,
      data.source_input,
      data.english_output,
      data.source_language,
      data.profile_version
    ).catch((generationError) => {
      console.error("[BridgeMode] Reflect route generation error:", generationError);
    });
  }

  return NextResponse.json({ triggered: true }, { status: 200 });
}
