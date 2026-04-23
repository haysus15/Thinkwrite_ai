import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { parseWorksheetText } from "@/lib/math-mode/worksheetParser";
import { extractTextFromFile } from "@/lib/utils/extractText";

function getClaudeApiKey() {
  return process.env.CLAUDE_API_KEY || null;
}

function readFirstText(content: unknown): string {
  if (!Array.isArray(content) || content.length === 0) return "";
  return content
    .map((entry) => {
      if (!entry || typeof entry !== "object" || !("type" in entry)) return "";
      const block = entry as { type?: string; text?: unknown };
      return block.type === "text" && typeof block.text === "string"
        ? block.text
        : "";
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
    max_tokens: 1200,
    system:
      "Extract only the math worksheet problem text from this image. Keep numbering and symbols.",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type:
                file.type === "image/png" ? "image/png" : "image/jpeg",
              data: base64,
            },
          },
          {
            type: "text",
            text: "Extract the worksheet's problem statements exactly as written.",
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
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const problemSetId = String(formData.get("problem_set_id") || "");

    if (!(file instanceof File) || !problemSetId) {
      return NextResponse.json(
        { error: "file and problem_set_id are required." },
        { status: 400 }
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File exceeds 10MB limit." },
        { status: 400 }
      );
    }

    const mime = file.type || "";
    if (!["application/pdf", "image/png", "image/jpeg", "image/jpg"].includes(mime)) {
      return NextResponse.json(
        { error: "Unsupported file type." },
        { status: 400 }
      );
    }

    const apiKey = getClaudeApiKey();
    let extractedText = "";

    if (mime.startsWith("image/") && apiKey) {
      extractedText = await extractTextFromImage(file, apiKey);
    } else if (mime === "application/pdf") {
      const extracted = await extractTextFromFile(file);
      if (!extracted.ok) {
        const extractionError =
          "error" in extracted ? extracted.error : "Could not extract text from PDF.";
        throw new Error(extractionError || "Could not extract text from PDF.");
      }
      if (!extracted.text?.trim()) {
        throw new Error("Could not extract text from PDF.");
      }
      extractedText = extracted.text;
    } else {
      extractedText = await file.text();
    }

    const problems = await parseWorksheetText({
      text: extractedText,
      apiKey,
    });

    return NextResponse.json({ problems });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to parse uploaded worksheet.",
      },
      { status: 500 }
    );
  }
}
