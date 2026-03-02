// src/app/api/study/upload/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { extractTextFromFile } from "@/lib/mirror-mode/extractText";
import { ingestStudioWriting } from "@/lib/mirror-mode/studioIngestion";

export const runtime = "nodejs";
const MIRROR_REFERENCE_PATTERN = /syllabus|assignment[_\s-]?requirements?|writing[_\s-]?requirements?|course[_\s-]?requirements?|school[_\s-]?requirements?|job[_\s-]?analysis/i;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function sanitizeStudyMaterialText(raw: string): string {
  const pdfArtifactPattern =
    /\/BaseFont|\/Font|\/Type|\/Subtype|\/Length|\/Filter|\/ProcSet|\/ImageC|CIDInit|ProcSet|CMapName|begincmap|endcmap|beginbfchar|endbfchar|currentdict|defineresource|Adobe-Identity-UCS|Identity-H|obj\b|endobj|stream\b|endstream|xref|startxref|trailer|<<|>>/i;

  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line.length > 2 && line.length < 400)
    .filter((line) => !pdfArtifactPattern.test(line))
    .filter((line) => (line.match(/\//g) || []).length < 2);

  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    if (seen.has(line)) continue;
    seen.add(line);
    const tokenCount = (line.match(/[A-Za-z]{2,}/g) || []).length;
    if (tokenCount < 2) continue;
    deduped.push(line);
  }

  return deduped.join("\n").trim();
}

function hasSufficientNaturalLanguage(text: string): boolean {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 5) return false;

  const strongLines = lines.filter((line) => {
    const words = line.split(/\s+/).filter(Boolean);
    if (words.length < 5) return false;
    const naturalWords = words.filter((word) =>
      /^[A-Za-z][A-Za-z'’-]{2,}$/.test(word)
    );
    if (naturalWords.length / Math.max(words.length, 1) < 0.55) return false;
    if (/[A-Za-z0-9_$@#%!?;:,.=\-+\\/]{16,}/.test(line)) return false;
    return true;
  });

  return strongLines.length >= 5;
}

async function cleanWithAI(raw: string): Promise<string> {
  if (!process.env.OPENAI_API_KEY) return "";
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Clean the extracted study material text. Keep only meaningful educational/instructional content. Remove PDF internals, encoding artifacts, random symbol strings, and metadata. Return plain text only.",
        },
        {
          role: "user",
          content: raw.slice(0, 25000),
        },
      ],
      temperature: 0.1,
      max_tokens: 3000,
    });
    return (response.choices[0]?.message?.content || "").trim();
  } catch {
    return "";
  }
}

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
  const pastedContent = String(formData.get("content") || "").trim();
  const title = String(formData.get("title") || "");
  const className = String(formData.get("className") || "");
  const topic = String(formData.get("topic") || "");
  // Keep source_type on an allowed DB value; store richer source metadata in title/class/topic.
  const sourceType = "uploaded";

  const hasFile = file instanceof File;
  const hasPastedContent = pastedContent.length > 0;
  if (!hasFile && !hasPastedContent) {
    return NextResponse.json(
      { success: false, error: "Upload a file or paste study material text." },
      { status: 400 }
    );
  }

  let rawStudyText = pastedContent;
  let fileType = "text/plain";
  let fileSize = pastedContent.length;
  let extractionMethod: "paste" | "txt" | "docx" | "pdf" = "paste";
  let sourceName = title || "Pasted study material";

  if (hasFile) {
    const uploadFile = file as File;
    sourceName = title || uploadFile.name;
    fileType = uploadFile.type || "application/octet-stream";
    fileSize = uploadFile.size || 0;
    const extractResult = await extractTextFromFile(uploadFile);
    if (!extractResult.ok) {
      return NextResponse.json(
        { success: false, error: extractResult.error },
        { status: 400 }
      );
    }
    rawStudyText = (extractResult.text || "").trim();
    extractionMethod = extractResult.method;
  }

  let cleanedStudyText = sanitizeStudyMaterialText(rawStudyText);
  const hasStrongCleanedText =
    cleanedStudyText.length >= 300 &&
    hasSufficientNaturalLanguage(cleanedStudyText);
  const hasUsableRawText =
    rawStudyText.length >= 300 && hasSufficientNaturalLanguage(rawStudyText);

  // PDFs are often noisier. Try an AI cleanup pass before rejecting.
  if (
    !hasStrongCleanedText &&
    extractionMethod === "pdf" &&
    rawStudyText.length >= 120
  ) {
    const aiCleaned = sanitizeStudyMaterialText(await cleanWithAI(rawStudyText));
    if (aiCleaned.length > cleanedStudyText.length) {
      cleanedStudyText = aiCleaned;
    }
  }

  const finalHasStrongCleaned =
    cleanedStudyText.length >= 300 &&
    hasSufficientNaturalLanguage(cleanedStudyText);
  const finalHasUsableRaw =
    rawStudyText.length >= 80 && hasSufficientNaturalLanguage(rawStudyText);

  if (rawStudyText.length < 20 && cleanedStudyText.length < 20) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Could not extract readable text from this file. Try another PDF, DOCX/TXT, or paste text directly.",
      },
      { status: 400 }
    );
  }

  const finalStudyText = finalHasStrongCleaned
    ? cleanedStudyText
    : cleanedStudyText.length >= 80
    ? cleanedStudyText
    : rawStudyText;
  const uploadWarning =
    finalHasStrongCleaned || finalHasUsableRaw
      ? null
      : "Upload saved with low-confidence extraction. If quiz quality is weak, upload DOCX/TXT or paste text.";

  const supabase = await createSupabaseServerClient();
  const { data, error: insertError } = await supabase
    .from("study_materials")
    .insert({
      user_id: userId,
      title: sourceName,
      content: finalStudyText,
      file_url: null,
      file_type: fileType,
      class_name: className || null,
      topic: topic || null,
      source_type: sourceType,
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
  const mirrorContext = `study_material_upload ${sourceName} ${topic || ""}`.trim();
  const isReferenceArtifact = MIRROR_REFERENCE_PATTERN.test(mirrorContext);
  if (!isReferenceArtifact) {
    try {
      await ingestStudioWriting({
        supabase,
        userId,
        sourceStudio: "academic",
        text: finalStudyText,
        sessionId: data.id,
        context: mirrorContext,
        fileName: sourceName,
        mimeType: fileType || "text/plain",
        fileSize: fileSize || finalStudyText.length,
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
    { success: true, material: data, warning: uploadWarning },
    { status: 200 }
  );
}
