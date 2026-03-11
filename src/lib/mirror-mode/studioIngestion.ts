import { learnFromTextDirect } from "@/lib/mirror-mode/liveLearning";
import type { WritingType } from "@/lib/mirror-mode/writingTypes";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  shouldExcludeFromProfile,
  type SourceAuthority,
} from "@/lib/mirror-mode/sourceAuthority";
import {
  MINIMUM_WORD_COUNT,
  shouldIngestForProfile,
} from "@/lib/mirror-mode/ingestionPolicy";

export type Studio = "career" | "academic" | "creative";

const STUDIO_DEFAULT_WRITING_TYPE: Record<Studio, WritingType> = {
  career: "professional",
  academic: "academic",
  creative: "creative",
};

const ARCHIVE_EXCLUSION_PATTERNS = [
  /syllabus/i,
  /assignment[_\s-]?requirements?/i,
  /writing[_\s-]?requirements?/i,
  /course[_\s-]?requirements?/i,
  /school[_\s-]?requirements?/i,
  /job[_\s-]?analysis/i,
  /requirement[_\s-]?snapshot/i,
];

type StudioIngestionParams = {
  supabase: SupabaseClient;
  userId: string;
  sourceStudio: Studio;
  sourceAuthority: SourceAuthority;
  text: string;
  sessionId?: string | null;
  context?: string | null;
  title?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  writingType?: WritingType;
  registerInArchive?: boolean;
};

type StudioIngestionResult = {
  captured: boolean;
  archived: boolean;
  needsConsent: boolean;
  mirrorDocumentId: string | null;
  wordCount: number;
};

function shouldExcludeFromArchive(context?: string | null): boolean {
  if (!context) return false;
  return ARCHIVE_EXCLUSION_PATTERNS.some((pattern) => pattern.test(context));
}

async function resolveCurrentEpochNumber(supabase: SupabaseClient, userId: string): Promise<number> {
  try {
    const { data: epochRow } = await supabase
      .from("voice_profile_epochs")
      .select("epoch_number")
      .eq("user_id", userId)
      .is("ended_at", null)
      .order("epoch_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    return epochRow?.epoch_number || 1;
  } catch {
    return 1;
  }
}

async function upsertMirrorContent(
  supabase: SupabaseClient,
  documentId: string,
  text: string
): Promise<void> {
  const { data: existing } = await supabase
    .from("mirror_document_content")
    .select("document_id")
    .eq("document_id", documentId)
    .maybeSingle();

  if (existing?.document_id) {
    await supabase
      .from("mirror_document_content")
      .update({
        extracted_text: text,
        extraction_method: "studio_capture",
      })
      .eq("document_id", documentId);
    return;
  }

  await supabase
    .from("mirror_document_content")
    .insert({
      document_id: documentId,
      extracted_text: text,
      extraction_method: "studio_capture",
    });
}

export async function ingestStudioWriting(params: StudioIngestionParams): Promise<StudioIngestionResult> {
  const {
    supabase,
    userId,
    sourceStudio,
    sourceAuthority,
    text,
    sessionId,
    context,
    title,
    fileName,
    mimeType,
    fileSize,
    writingType,
    registerInArchive = true,
  } = params;

  const cleanedText = String(text || "").trim();
  const wordCount = cleanedText.split(/\s+/).filter(Boolean).length;

  if (!cleanedText || wordCount < MINIMUM_WORD_COUNT) {
    return {
      captured: false,
      archived: false,
      needsConsent: false,
      mirrorDocumentId: null,
      wordCount,
    };
  }

  const { data: consent } = await supabase
    .from("mirror_mode_consent")
    .select("id")
    .eq("user_id", userId)
    .eq("studio", sourceStudio)
    .maybeSingle();

  if (!consent?.id) {
    return {
      captured: false,
      archived: false,
      needsConsent: true,
      mirrorDocumentId: null,
      wordCount,
    };
  }

  const resolvedWritingType = writingType || STUDIO_DEFAULT_WRITING_TYPE[sourceStudio];
  const canonicalName = (fileName || title || context || `${sourceStudio} writing sample`).trim();
  const canonicalDocKey = sessionId ? `studio:${sourceStudio}:${sessionId}` : null;

  const ingestionDecision = shouldIngestForProfile(wordCount, sourceAuthority);
  if (ingestionDecision.eligible) {
    await learnFromTextDirect({
      userId,
      text: cleanedText,
      source: "other",
      sourceAuthority,
      metadata: {
        context: context || null,
        documentId: canonicalDocKey || undefined,
        title: canonicalName,
        writingType: resolvedWritingType,
      },
    });
  }

  const excludeFromArchive = shouldExcludeFromArchive(context);
  const canArchive =
    registerInArchive &&
    !excludeFromArchive &&
    wordCount >= MINIMUM_WORD_COUNT;

  if (!canArchive) {
    return {
      captured: true,
      archived: false,
      needsConsent: false,
      mirrorDocumentId: null,
      wordCount,
    };
  }

  let existingDocumentId: string | null = null;
  if (canonicalDocKey) {
    const { data: existing } = await supabase
      .from("mirror_documents")
      .select("id")
      .eq("user_id", userId)
      .eq("storage_path", canonicalDocKey)
      .maybeSingle();
    existingDocumentId = existing?.id || null;
  }

  if (existingDocumentId) {
    const excluded = shouldExcludeFromProfile(sourceAuthority);
    await supabase
      .from("mirror_documents")
      .update({
        file_name: canonicalName,
        mime_type: mimeType || "text/plain",
        file_size: fileSize || cleanedText.length,
        writing_type: resolvedWritingType,
        word_count: wordCount,
        status: "learned",
        learned_at: new Date().toISOString(),
        source_authority: sourceAuthority,
        excluded_from_profile: excluded,
      })
      .eq("id", existingDocumentId);

    await upsertMirrorContent(supabase, existingDocumentId, cleanedText);

    return {
      captured: true,
      archived: true,
      needsConsent: false,
      mirrorDocumentId: existingDocumentId,
      wordCount,
    };
  }

  const epochNumber = await resolveCurrentEpochNumber(supabase, userId);
  const excluded = shouldExcludeFromProfile(sourceAuthority);
  const insertPayload: Record<string, any> = {
    user_id: userId,
    file_name: canonicalName,
    mime_type: mimeType || "text/plain",
    file_size: fileSize || cleanedText.length,
    storage_path: canonicalDocKey,
    writing_type: resolvedWritingType,
    word_count: wordCount,
    status: "learned",
    training_allowed: true,
    learned_at: new Date().toISOString(),
    source_authority: sourceAuthority,
    excluded_from_profile: excluded,
    visibility_status: "active",
    epoch_number: epochNumber,
  };

  let { data: inserted, error: insertError } = await supabase
    .from("mirror_documents")
    .insert(insertPayload)
    .select("id")
    .single();

  if (
    insertError?.message?.includes("column") ||
    insertError?.message?.includes("visibility_status") ||
    insertError?.message?.includes("epoch_number")
  ) {
    const fallbackPayload = {
      user_id: userId,
      file_name: canonicalName,
      mime_type: mimeType || "text/plain",
      file_size: fileSize || cleanedText.length,
      storage_path: canonicalDocKey,
      writing_type: resolvedWritingType,
      word_count: wordCount,
      status: "learned",
      training_allowed: true,
      learned_at: new Date().toISOString(),
      source_authority: sourceAuthority,
      excluded_from_profile: excluded,
    };
    ({ data: inserted, error: insertError } = await supabase
      .from("mirror_documents")
      .insert(fallbackPayload)
      .select("id")
      .single());
  }

  if (insertError || !inserted?.id) {
    return {
      captured: true,
      archived: false,
      needsConsent: false,
      mirrorDocumentId: null,
      wordCount,
    };
  }

  await upsertMirrorContent(supabase, inserted.id, cleanedText);

  return {
    captured: true,
    archived: true,
    needsConsent: false,
    mirrorDocumentId: inserted.id,
    wordCount,
  };
}
