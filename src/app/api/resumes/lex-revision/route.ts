import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, createSupabaseAdmin } from "@/lib/auth/getAuthUser";
import { Errors } from "@/lib/api/errors";
import ContentAwareEducationalScoringEngine from "@/lib/educational-scoring-engine";
import { ingestStudioWriting } from "@/lib/mirror-mode/studioIngestion";
import { SOURCE_AUTHORITY } from "@/lib/mirror-mode/sourceAuthority";

const scoringEngine = new ContentAwareEducationalScoringEngine();

function cleanTextContent(text: string): string {
  return text
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\uFEFF/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildRevisedFileName(original: string, provided?: string | null) {
  if (provided && provided.trim().length > 0) {
    return provided.trim();
  }

  const trimmed = original.trim();
  const dotIndex = trimmed.lastIndexOf(".");

  if (dotIndex <= 0) {
    return `${trimmed} (Lex Revised)`;
  }

  const base = trimmed.slice(0, dotIndex);
  const ext = trimmed.slice(dotIndex);
  return `${base} (Lex Revised)${ext}`;
}

export async function POST(request: NextRequest) {
  try {
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return Errors.unauthorized();
    }

    const body = await request.json();
    const sourceResumeId = String(body?.sourceResumeId || "").trim();
    const revisedText = String(body?.revisedText || "").trim();
    const fileNameOverride = typeof body?.fileName === "string" ? body.fileName : null;

    if (!sourceResumeId) {
      return Errors.missingField("sourceResumeId");
    }

    if (!revisedText || revisedText.length < 120) {
      return Errors.validationError("Revised resume text is too short to save.");
    }

    const supabase = createSupabaseAdmin();

    const { data: sourceResume, error: sourceError } = await supabase
      .from("user_documents")
      .select("id, file_name, file_type, is_master_resume")
      .eq("id", sourceResumeId)
      .eq("user_id", userId)
      .single();

    if (sourceError || !sourceResume) {
      return Errors.notFound("Source resume");
    }

    const cleanedContent = cleanTextContent(revisedText);
    const analysisResults = await scoringEngine.analyzeResume(
      cleanedContent,
      sourceResume.file_name || "Lex Revised Resume"
    );

    const newFileName = buildRevisedFileName(sourceResume.file_name || "Resume", fileNameOverride);

    const insertPayload = {
      user_id: userId,
      file_name: newFileName,
      file_type: sourceResume.file_type || "text/plain",
      file_size: cleanedContent.length,
      extracted_text: cleanedContent,
      is_master_resume: false,
      is_active: true,
      analysis_summary: JSON.stringify(analysisResults),
      ats_score: analysisResults.overallScore,
      recommendations: JSON.stringify(analysisResults.recommendations || []),
      key_points: JSON.stringify({
        resumeQuotes: analysisResults.resumeQuotes || [],
        educationalInsights: analysisResults.educationalInsights || [],
      }),
      upload_source: "lex_revision",
    } as const;

    const { data: newResume, error: insertError } = await supabase
      .from("user_documents")
      .insert(insertPayload)
      .select("id, file_name, file_type, file_size, is_master_resume, created_at")
      .single();

    if (insertError || !newResume) {
      return Errors.databaseError(insertError?.message || "Failed to save revised resume");
    }

    // Mirror Mode: Learn + archive accepted resume revision in career chamber
    let mirrorResult: Awaited<ReturnType<typeof ingestStudioWriting>> | null = null;
    try {
      mirrorResult = await ingestStudioWriting({
        supabase,
        userId,
        sourceStudio: "career",
        sourceAuthority: SOURCE_AUTHORITY.AI_GENERATED_ACCEPTED,
        text: cleanedContent,
        sessionId: newResume.id,
        context: "lex_resume_revision",
        fileName: newFileName,
        mimeType: sourceResume.file_type || "text/plain",
        fileSize: cleanedContent.length,
        writingType: "professional",
        registerInArchive: true,
      });
    } catch {
      // Silent fail
    }

    // Mirror Mode: Update lineage (best effort). This is a user-accepted revision.
    try {
      const { data: existingLineage } = await supabase
        .from("document_lineage")
        .select("id, version_history")
        .eq("user_id", userId)
        .eq("original_document_id", sourceResumeId)
        .maybeSingle();

      if (existingLineage?.id) {
        const nextHistory = Array.isArray(existingLineage.version_history)
          ? [...existingLineage.version_history]
          : [];
        nextHistory.push({
          version_type: "user_modified",
          document_id: newResume.id,
          source_studio: "career",
          document_type: "resume_revision",
          created_at: new Date().toISOString(),
        });

        await supabase
          .from("document_lineage")
          .update({
            current_version_id: newResume.id,
            version_history: nextHistory,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingLineage.id);
      } else {
        await supabase
          .from("document_lineage")
          .insert({
            user_id: userId,
            original_document_id: sourceResumeId,
            studio_origin: "career",
            current_version_id: newResume.id,
            version_history: [
              {
                version_type: "original",
                document_id: sourceResumeId,
                source_studio: "career",
                document_type: "resume",
                created_at: new Date().toISOString(),
              },
              {
                version_type: "user_modified",
                document_id: newResume.id,
                source_studio: "career",
                document_type: "resume_revision",
                created_at: new Date().toISOString(),
              },
            ],
          });
      }
    } catch (e) {
      // Silent fail
    }

    return NextResponse.json({
      success: true,
      message: "Saved Lex revision as a new resume version.",
      resume: {
        id: newResume.id,
        fileName: newResume.file_name,
        fileType: newResume.file_type,
        fileSize: newResume.file_size,
        isMasterResume: newResume.is_master_resume,
        uploadedAt: new Date(newResume.created_at),
        analysisResults,
        analysisStatus: "complete",
        hasLegacyAnalysis: false,
      },
      mirror: mirrorResult,
    });
  } catch (error: any) {
    console.error("[Resumes Lex Revision POST]:", error?.message || error);
    return Errors.internal();
  }
}
