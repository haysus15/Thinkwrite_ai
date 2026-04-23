import { NextResponse } from "next/server";
import type { StudentAcademicProfile } from "@/components/academic/outline/outlineTypes";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildStudentAcademicProfile } from "@/lib/academic/victor/studentProfile";

function mergeProfileOverrides(
  profile: StudentAcademicProfile,
  overrides: StudentAcademicProfile["overridePatterns"]
): StudentAcademicProfile {
  return {
    ...profile,
    overridePatterns: overrides,
    thesisStrength: overrides.thesisStrength ?? profile.thesisStrength,
    counterargumentStrength:
      overrides.counterargumentStrength ?? profile.counterargumentStrength,
    conclusionStrength:
      overrides.conclusionStrength ?? profile.conclusionStrength,
  };
}

export async function GET() {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  const profile = await buildStudentAcademicProfile(userId, supabase);
  const { data: prefs } = await supabase
    .from("user_preferences")
    .select("academic_settings")
    .eq("user_id", userId)
    .maybeSingle();

  const rawSettings =
    prefs?.academic_settings && typeof prefs.academic_settings === "object"
      ? (prefs.academic_settings as Record<string, unknown>)
      : {};
  const overrides =
    rawSettings.profileOverrides && typeof rawSettings.profileOverrides === "object"
      ? (rawSettings.profileOverrides as StudentAcademicProfile["overridePatterns"])
      : {};

  return NextResponse.json(mergeProfileOverrides(profile, overrides));
}

export async function PATCH(request: Request) {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    profileOverrides?: StudentAcademicProfile["overridePatterns"];
  };
  const profileOverrides = body.profileOverrides ?? {};
  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("user_preferences")
    .select("academic_settings")
    .eq("user_id", userId)
    .maybeSingle();

  const currentSettings =
    existing?.academic_settings && typeof existing.academic_settings === "object"
      ? (existing.academic_settings as Record<string, unknown>)
      : {};

  const { error: upsertError } = await supabase.from("user_preferences").upsert(
    {
      user_id: userId,
      academic_settings: {
        ...currentSettings,
        profileOverrides,
      },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (upsertError) {
    return NextResponse.json(
      { error: upsertError.message || "Failed to save profile overrides." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
