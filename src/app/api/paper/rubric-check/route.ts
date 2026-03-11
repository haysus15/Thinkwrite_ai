import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthUser } from "@/lib/auth/getAuthUser";

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

export async function POST(request: Request) {
  const { userId } = await getAuthUser();
  if (!userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const rubricText = typeof body?.rubric_text === "string" ? body.rubric_text.trim() : "";
    const paperContent =
      typeof body?.paper_content === "string" ? body.paper_content.trim() : "";

    if (!rubricText || !paperContent) {
      return NextResponse.json(
        { error: "rubric_text and paper_content are required." },
        { status: 400 }
      );
    }

    const apiKey = getClaudeApiKey();
    if (!apiKey) {
      return NextResponse.json({ assessment: "Rubric check unavailable right now." });
    }

    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 260,
      system: "Provide concise, factual rubric checks. No grades.",
      messages: [
        {
          role: "user",
          content: `Given this rubric: ${rubricText}
and this paper content: ${paperContent}
provide a brief assessment of how well the paper addresses each rubric criterion.
Be specific and factual. Do not assign a grade. Maximum 3 sentences total.`,
        },
      ],
    });

    const assessment = readFirstText(response.content) || "Rubric check unavailable right now.";
    return NextResponse.json({ assessment });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to run rubric check." },
      { status: 500 }
    );
  }
}
