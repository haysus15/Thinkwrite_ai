import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createMathPractice } from "@/lib/math-mode/db";

function getClaudeApiKey() {
  return process.env.CLAUDE_API_KEY || null;
}

function readFirstText(content: unknown): string {
  if (!Array.isArray(content) || content.length === 0) return "";
  const first = content[0];
  if (first && typeof first === "object" && "type" in first) {
    const block = first as { type?: string; text?: unknown };
    if (block.type === "text" && typeof block.text === "string") {
      return block.text;
    }
  }
  return "";
}

export async function POST(request: Request) {
  const { userId } = await getAuthUser();
  if (!userId) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  const apiKey = getClaudeApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Claude API key missing" },
      { status: 500 }
    );
  }

  const body = await request.json();
  const latex = body?.latex || "";
  const difficulty = body?.difficulty || "same";

  const anthropic = new Anthropic({ apiKey });
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 200,
    system: `Generate one practice problem in LaTeX only. Do not include solutions.`,
    messages: [
      {
        role: "user",
        content: `Original problem: ${latex}
Difficulty: ${difficulty}`,
      },
    ],
  });

  try {
    const practiceLatex = readFirstText(response.content) || latex;
    const practice = await createMathPractice({
      userId,
      latex: practiceLatex.trim(),
      difficulty,
      problemType: body?.problem_type || "other",
    });

    return NextResponse.json({ practice });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create practice problem.",
      },
      { status: 500 }
    );
  }
}
