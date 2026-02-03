import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const { userId, error: authError } = await getAuthUser();
  if (authError || !userId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const {
    contentType,
    studioType,
    originalContent,
    action,
    editedContent,
    confidenceLevel,
    feedbackNote,
    generationId,
  } = await req.json();

  if (!contentType || !studioType || !originalContent || !action) {
    return NextResponse.json(
      { success: false, error: "Missing required fields" },
      { status: 400 }
    );
  }

  if (!["accepted", "edited", "rejected"].includes(action)) {
    return NextResponse.json(
      { success: false, error: "Invalid action" },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();

  const { data: voiceProfile } = await supabase
    .from("voice_profiles")
    .select("id")
    .eq("user_id", userId)
    .single();

  const { error } = await supabase.from("voice_feedback").insert({
    user_id: userId,
    voice_profile_id: voiceProfile?.id || null,
    content_type: contentType,
    studio_type: studioType,
    original_content: originalContent,
    action,
    edited_content: editedContent || null,
    confidence_level: confidenceLevel || null,
    feedback_note: feedbackNote || null,
    generation_id: generationId || null,
  });

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  await maybeRefineVoiceProfile(supabase, userId);

  return NextResponse.json({ success: true });
}

async function maybeRefineVoiceProfile(supabase: any, userId: string) {
  const { count } = await supabase
    .from("voice_feedback")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte(
      "created_at",
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    );

  if ((count || 0) >= 5) {
    console.log(
      `[Voice Feedback] User ${userId} has ${count} recent feedback items - consider refinement`
    );
  }
}
