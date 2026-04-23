import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin, getAuthUser } from "@/lib/auth/getAuthUser";
import { SOURCE_AUTHORITY } from "@/lib/mirror-core/sourceAuthority";

function wordCount(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function mapBridgeStudioToWritingType(studio: "academic" | "career" | "mirror") {
  switch (studio) {
    case "academic":
      return "academic" as const;
    case "career":
      return "professional" as const;
    default:
      return "general" as const;
  }
}

export async function POST(request: NextRequest) {
  const { userId, error: authError } = await getAuthUser();
  if (authError || !userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  let body: {
    studio?: "academic" | "career" | "mirror";
    source_language?: string;
    target_language?: string;
    source_input?: string;
    english_output?: string;
    profile_version?: 1 | 2;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    !body.studio ||
    !body.source_language ||
    !body.target_language ||
    !body.source_input ||
    !body.english_output ||
    (body.profile_version !== 1 && body.profile_version !== 2)
  ) {
    return NextResponse.json({ error: "Missing required Bridge session fields" }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("bridge_mode_sessions")
    .insert({
      user_id: userId,
      studio: body.studio,
      source_language: body.source_language,
      target_language: body.target_language,
      source_input: body.source_input,
      english_output: body.english_output,
      profile_version: body.profile_version,
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Failed to create Bridge session" }, { status: 500 });
  }

  const writingType = mapBridgeStudioToWritingType(body.studio);
  const englishOutput = body.english_output.trim();
  const nowIso = new Date().toISOString();
  const mirrorDocumentBase = {
    user_id: userId,
    file_name: `bridge-${body.studio}-${nowIso}.txt`,
    mime_type: "text/plain",
    file_size: englishOutput.length,
    storage_path: `${userId}/bridge/${data.id}.txt`,
    writing_type: writingType,
    word_count: wordCount(englishOutput),
    status: "learned",
    training_allowed: true,
    source_authority: SOURCE_AUTHORITY.AI_GENERATED_ACCEPTED,
    excluded_from_profile: true,
    language: "en",
    language_confidence: 1,
    language_override: "en",
    is_cross_language_output: true,
  };

  let mirrorDocumentId: string | null = null;

  {
    let insertPayload: Record<string, unknown> = {
      ...mirrorDocumentBase,
      visibility_status: "active",
      learned_at: nowIso,
    };

    let insertResult = await supabase
      .from("mirror_documents")
      .insert(insertPayload)
      .select("id")
      .single();

    if (
      insertResult.error?.message?.includes("column") ||
      insertResult.error?.message?.includes("visibility_status")
    ) {
      insertPayload = {
        ...mirrorDocumentBase,
        learned_at: nowIso,
      };
      insertResult = await supabase
        .from("mirror_documents")
        .insert(insertPayload)
        .select("id")
        .single();
    }

    if (!insertResult.error && insertResult.data?.id) {
      mirrorDocumentId = insertResult.data.id;
      const { error: contentError } = await supabase.from("mirror_document_content").insert({
        user_id: userId,
        document_id: mirrorDocumentId,
        extracted_text: englishOutput,
      });
      if (contentError) {
        await supabase.from("mirror_documents").delete().eq("id", mirrorDocumentId);
        await supabase.from("bridge_mode_sessions").delete().eq("id", data.id);
        return NextResponse.json(
          { error: contentError.message || "Failed to store Bridge document content" },
          { status: 500 }
        );
      }
    } else if (insertResult.error) {
      await supabase.from("bridge_mode_sessions").delete().eq("id", data.id);
      return NextResponse.json(
        { error: insertResult.error.message || "Failed to create Bridge mirror document" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ id: data.id }, { status: 200 });
}
