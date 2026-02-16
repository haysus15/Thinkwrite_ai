// src/app/api/study/upload/route.ts
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { extractTextFromFile } from "@/lib/mirror-mode/extractText";
import { ingestStudioWriting } from "@/lib/mirror-mode/studioIngestion";

export const runtime = "nodejs";
const MIRROR_REFERENCE_PATTERN = /syllabus|assignment[_\s-]?requirements?|writing[_\s-]?requirements?|course[_\s-]?requirements?|school[_\s-]?requirements?|job[_\s-]?analysis/i;

export async function POST(request: Request) {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const title = String(formData.get("title") || "");
  const className = String(formData.get("className") || "");
  const topic = String(formData.get("topic") || "");

  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { success: false, error: "File is required." },
      { status: 400 }
    );
  }

  const extractResult = await extractTextFromFile(file);
  if (!extractResult.ok) {
    return NextResponse.json(
      { success: false, error: extractResult.error },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error: insertError } = await supabase
    .from("study_materials")
    .insert({
      user_id: userId,
      title: title || file.name,
      content: extractResult.text,
      file_url: null,
      file_type: file.type,
      class_name: className || null,
      topic: topic || null,
      source_type: "uploaded",
      source_id: null,
    })
    .select("id, title")
    .single();

  if (insertError || !data) {
    return NextResponse.json(
      { success: false, error: insertError?.message || "Upload failed." },
      { status: 500 }
    );
  }

  // Mirror Mode: ingest academic uploads unless they are reference artifacts.
  const mirrorContext = `study_material_upload ${title || file.name} ${topic || ""}`.trim();
  const isReferenceArtifact = MIRROR_REFERENCE_PATTERN.test(mirrorContext);
  if (!isReferenceArtifact) {
    try {
      await ingestStudioWriting({
        supabase,
        userId,
        sourceStudio: "academic",
        text: extractResult.text,
        sessionId: data.id,
        context: mirrorContext,
        fileName: title || file.name,
        mimeType: file.type || "text/plain",
        fileSize: file.size || extractResult.text.length,
        writingType: "academic",
        registerInArchive: true,
      });
    } catch {
      // Silent fail
    }
  }

  // Mirror Mode: Register lineage (best effort)
  try {
    await supabase
      .from("document_lineage")
      .insert({
        user_id: userId,
        original_document_id: data.id,
        studio_origin: "academic",
        current_version_id: data.id,
        version_history: [
          {
            version_type: "original",
            document_id: data.id,
            source_studio: "academic",
            document_type: "study_material",
            created_at: new Date().toISOString(),
          },
        ],
      });
  } catch (e) {
    // Silent fail
  }

  return NextResponse.json(
    { success: true, material: data },
    { status: 200 }
  );
}
