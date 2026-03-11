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
    const challengeDescription =
      typeof body?.challenge_description === "string"
        ? body.challenge_description.trim()
        : "";
    const codeContent =
      typeof body?.code_content === "string" ? body.code_content.trim() : "";

    if (!challengeDescription || !codeContent) {
      return NextResponse.json(
        { error: "challenge_description and code_content are required." },
        { status: 400 }
      );
    }

    const apiKey = getClaudeApiKey();
    if (!apiKey) {
      return NextResponse.json({ assessment: "Quality snapshot unavailable right now." });
    }

    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 260,
      system: "Provide concise, factual code review feedback. No grades.",
      messages: [
        {
          role: "user",
          content: `Review this code for the following challenge: ${challengeDescription}.
Code:\n${codeContent}

Provide a brief 2-3 sentence assessment of: correctness, code quality, and one specific improvement the student could make.
Do not rewrite the code. Be direct and specific.`,
        },
      ],
    });

    const assessment = readFirstText(response.content) || "Quality snapshot unavailable right now.";
    return NextResponse.json({ assessment });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to run quality snapshot.",
      },
      { status: 500 }
    );
  }
}
