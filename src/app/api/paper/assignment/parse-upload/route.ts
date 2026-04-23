import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { extractTextFromFile } from "@/lib/utils/extractText";
import { parseAssignmentPrompts } from "@/lib/paper-workflow/assignmentParser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function getClaudeApiKey() {
  return process.env.CLAUDE_API_KEY || null;
}

function readFirstText(content: unknown): string {
  if (!Array.isArray(content) || content.length === 0) return "";
  return content
    .map((entry) => {
      if (!entry || typeof entry !== "object" || !("type" in entry)) return "";
      const block = entry as { type?: string; text?: unknown };
      return block.type === "text" && typeof block.text === "string" ? block.text : "";
    })
    .join("\n")
    .trim();
}

async function extractTextFromImage(file: File, apiKey: string) {
  const anthropic = new Anthropic({ apiKey });
  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1400,
    system:
      "Extract only assignment and rubric text from this writing assignment image. Keep numbering and labels.",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: file.type === "image/png" ? "image/png" : "image/jpeg",
              data: base64,
            },
          },
          {
            type: "text",
            text: "Extract the assignment prompts exactly as written.",
          },
        ],
      },
    ],
  });

  return readFirstText(response.content);
}

export async function POST(request: Request) {
  const { userId } = await getAuthUser();
  if (!userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const assignmentSetId = String(formData.get("assignment_set_id") || "");

    if (!(file instanceof File) || !assignmentSetId) {
      return NextResponse.json(
        { error: "file and assignment_set_id are required." },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();
    const { data: setRow, error: setError } = await supabase
      .from("paper_assignment_sets")
      .select("id")
      .eq("id", assignmentSetId)
      .eq("user_id", userId)
      .maybeSingle();
    if (setError || !setRow) {
      return NextResponse.json({ error: "Assignment set not found." }, { status: 404 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File exceeds 10MB limit." }, { status: 400 });
    }

    const mime = file.type || "";
    if (!["application/pdf", "image/png", "image/jpeg", "image/jpg"].includes(mime)) {
      return NextResponse.json({ error: "Unsupported file type." }, { status: 400 });
    }

    const apiKey = getClaudeApiKey();
    let extractedText = "";

    if (mime.startsWith("image/") && apiKey) {
      extractedText = await extractTextFromImage(file, apiKey);
    } else if (mime === "application/pdf") {
      const extracted = await extractTextFromFile(file);
      if (!extracted.ok) {
        const extractionError = "error" in extracted ? extracted.error : "Could not extract text from PDF.";
        throw new Error(extractionError || "Could not extract text from PDF.");
      }
      extractedText = extracted.text || "";
    } else {
      extractedText = await file.text();
    }

    if (!extractedText.trim()) {
      return NextResponse.json({ error: "No readable text found in uploaded file." }, { status: 400 });
    }

    const prompts = await parseAssignmentPrompts({ text: extractedText, apiKey });
    return NextResponse.json({ prompts });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to parse uploaded assignment." },
      { status: 500 }
    );
  }
}
