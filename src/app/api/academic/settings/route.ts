import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  DEFAULT_ACADEMIC_SETTINGS,
  type AcademicSettings,
} from "@/components/academic/chat/chatTypes";

function mergeAcademicSettings(value: unknown): AcademicSettings {
  if (!value || typeof value !== "object") {
    return DEFAULT_ACADEMIC_SETTINGS;
  }

  const record = value as Partial<AcademicSettings>;
  return {
    sessionEntryPreference:
      record.sessionEntryPreference === "direct" ? "direct" : "chat_first",
    travisSessionMemory:
      typeof record.travisSessionMemory === "boolean"
        ? record.travisSessionMemory
        : DEFAULT_ACADEMIC_SETTINGS.travisSessionMemory,
    victorAvailability:
      record.victorAvailability === "always" ? "always" : "workflow_only",
  };
}

export async function GET() {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error: queryError } = await supabase
    .from("user_preferences")
    .select("academic_settings")
    .eq("user_id", userId)
    .maybeSingle();

  if (queryError && queryError.code !== "PGRST116") {
    return NextResponse.json(
      { success: false, error: queryError.message || "Failed to load settings." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    settings: mergeAcademicSettings(data?.academic_settings),
  });
}

export async function PATCH(request: NextRequest) {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as Partial<AcademicSettings>;
  const supabase = await createSupabaseServerClient();
  const { data: existing, error: queryError } = await supabase
    .from("user_preferences")
    .select("academic_settings")
    .eq("user_id", userId)
    .maybeSingle();

  if (queryError && queryError.code !== "PGRST116") {
    return NextResponse.json(
      { success: false, error: queryError.message || "Failed to load current settings." },
      { status: 500 }
    );
  }

  const mergedSettings = mergeAcademicSettings({
    ...(existing?.academic_settings &&
    typeof existing.academic_settings === "object"
      ? existing.academic_settings
      : {}),
    ...body,
  });

  const { error: upsertError } = await supabase.from("user_preferences").upsert(
    {
      user_id: userId,
      academic_settings: mergedSettings,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "user_id",
    }
  );

  if (upsertError) {
    return NextResponse.json(
      { success: false, error: upsertError.message || "Failed to save settings." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    settings: mergedSettings,
  });
}
