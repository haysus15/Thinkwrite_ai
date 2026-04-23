import "server-only";

import { createSupabaseAdmin } from "@/lib/auth/getAuthUser";
import { detectLanguage } from "@/lib/language/detectLanguage";
import { aggregateLanguageProfile } from "@/lib/mirror/aggregateLanguageProfile";

export interface RetagResult {
  processed: number;
  tagged: number;
  skipped: number;
  lowConfidence: number;
  failed: number;
  errors: string[];
}

type MirrorDocumentBatchRow = {
  id: string;
  user_id: string;
  created_at: string | null;
  is_cross_language_output: boolean | null;
  language: string | null;
  language_override: string | null;
  mirror_document_content?:
    | {
        extracted_text: string | null;
      }[]
    | null;
};

const BATCH_SIZE = 100;
const BATCH_DELAY_MS = 2000;
const JOB_NAME = "retag-mirror-documents";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toErrorMessage(documentId: string, error: unknown): string {
  const message = error instanceof Error ? error.message : "Unknown error";
  return `${documentId}: ${message}`;
}

export async function retagMirrorDocuments(): Promise<RetagResult> {
  const supabase = createSupabaseAdmin();
  const result: RetagResult = {
    processed: 0,
    tagged: 0,
    skipped: 0,
    lowConfidence: 0,
    failed: 0,
    errors: [],
  };

  while (true) {
    const { data, error } = await supabase
      .from("mirror_documents")
      .select(
        "id, user_id, created_at, is_cross_language_output, language, language_override, mirror_document_content(extracted_text)"
      )
      .is("language", null)
      .is("language_override", null)
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (error) {
      throw new Error(error.message || "Failed to load mirror documents for retagging");
    }

    const batch = ((data || []) as unknown) as MirrorDocumentBatchRow[];
    if (batch.length === 0) {
      return result;
    }

    const touchedPairs = new Set<string>();

    for (const document of batch) {
      result.processed += 1;

      if (document.is_cross_language_output) {
        result.skipped += 1;
        continue;
      }

      try {
        const text = document.mirror_document_content?.[0]?.extracted_text?.trim() || "";
        const detection = await detectLanguage(text);

        const { error: updateError } = await supabase
          .from("mirror_documents")
          .update({
            language: detection.language,
            language_confidence: detection.confidence,
          })
          .eq("id", document.id)
          .is("language", null)
          .is("language_override", null);

        if (updateError) {
          throw new Error(updateError.message || "Failed to update language fields");
        }

        const effectiveLanguage = detection.language || "und";
        touchedPairs.add(`${document.user_id}:${effectiveLanguage}`);

        if (detection.confidence >= 0.85) {
          result.tagged += 1;
        } else {
          result.lowConfidence += 1;
        }
      } catch (documentError) {
        result.failed += 1;
        result.errors.push(toErrorMessage(document.id, documentError));
      }
    }

    for (const pair of touchedPairs) {
      const [userId, language] = pair.split(":");
      if (!userId || !language) continue;
      try {
        await aggregateLanguageProfile(userId, language);
      } catch (aggregateError) {
        result.errors.push(
          `aggregate ${userId}/${language}: ${
            aggregateError instanceof Error ? aggregateError.message : "Unknown error"
          }`
        );
      }
    }

    if (batch.length < BATCH_SIZE) {
      return result;
    }

    await delay(BATCH_DELAY_MS);
  }
}

export { JOB_NAME as RETAG_MIRROR_DOCUMENTS_JOB_NAME };
