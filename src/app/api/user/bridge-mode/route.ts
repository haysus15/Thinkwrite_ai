import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";

export async function PATCH(request: NextRequest) {
  const { userId, error: authError } = await getAuthUser();
  if (authError || !userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  let body: { bridge_mode_enabled?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.bridge_mode_enabled !== "boolean") {
    return NextResponse.json({ error: "bridge_mode_enabled must be a boolean" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  if (body.bridge_mode_enabled) {
    const { data: profileData, error: profileError } = await supabase
      .from("user_profiles")
      .select("preferred_language")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json({ error: "Failed to load preferred language" }, { status: 500 });
    }

    const sourceLanguage = profileData?.preferred_language || "en";
    const { data: updatedUser, error: updateError } = await supabase
      .from("users")
      .update({
        bridge_mode_enabled: true,
        bridge_mode_source_language: sourceLanguage,
        bridge_mode_target_language: "en",
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .select("bridge_mode_enabled, bridge_mode_source_language, bridge_mode_target_language")
      .single();

    if (updateError || !updatedUser) {
      return NextResponse.json({ error: "Failed to update Bridge Mode" }, { status: 500 });
    }

    return NextResponse.json(updatedUser, { status: 200 });
  }

  const { data: updatedUser, error: updateError } = await supabase
    .from("users")
    .update({
      bridge_mode_enabled: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select("bridge_mode_enabled, bridge_mode_source_language, bridge_mode_target_language")
    .single();

  if (updateError || !updatedUser) {
    return NextResponse.json({ error: "Failed to update Bridge Mode" }, { status: 500 });
  }

  return NextResponse.json(updatedUser, { status: 200 });
}
