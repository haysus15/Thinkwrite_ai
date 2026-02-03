import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { mathStore } from "@/lib/math-mode/store";

function getClaudeApiKey() {
  return process.env.CLAUDE_API_KEY || null;
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

  const practiceLatex = response.content?.[0]?.text || latex;
  const practice = mathStore.createPractice({
    latex: practiceLatex.trim(),
    difficulty,
    attempted: false,
    completed: false,
  });

  return NextResponse.json({ practice });
}
