import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createMathPractice } from "@/lib/math-mode/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type GeneratedPracticeItem = {
  latex: string;
  plain_text?: string;
};

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

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function parseModelArray(text: string): GeneratedPracticeItem[] {
  const direct = safeJsonParse(text);
  if (Array.isArray(direct)) return direct as GeneratedPracticeItem[];

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    const parsed = safeJsonParse(fenced[1].trim());
    if (Array.isArray(parsed)) return parsed as GeneratedPracticeItem[];
  }

  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch?.[0]) {
    const parsed = safeJsonParse(arrayMatch[0]);
    if (Array.isArray(parsed)) return parsed as GeneratedPracticeItem[];
  }

  return [];
}

function mapDifficulty(value: number): "easier" | "same" | "harder" {
  if (value <= 2) return "easier";
  if (value >= 4) return "harder";
  return "same";
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
    const body = await request.json();
    const conceptTag =
      typeof body?.concept_tag === "string" ? body.concept_tag : "general";
    const originalProblemId =
      typeof body?.original_problem_id === "string"
        ? body.original_problem_id
        : "";
    const difficultyNumber = Number(body?.difficulty || 3);
    const safeDifficulty = Number.isFinite(difficultyNumber)
      ? Math.max(1, Math.min(5, Math.round(difficultyNumber)))
      : 3;

    if (!originalProblemId) {
      return NextResponse.json(
        { error: "original_problem_id is required." },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();
    const { data: originalProblem, error: originalError } = await supabase
      .from("math_problems")
      .select("id, latex, problem_type")
      .eq("id", originalProblemId)
      .eq("user_id", userId)
      .maybeSingle();
    if (originalError || !originalProblem) {
      return NextResponse.json(
        { error: originalError?.message || "Original problem not found." },
        { status: 404 }
      );
    }

    let generatedProblems: GeneratedPracticeItem[] = [];
    const apiKey = getClaudeApiKey();
    if (apiKey) {
      const anthropic = new Anthropic({ apiKey });
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 600,
        system:
          "Generate exactly 3 math practice problems as strict JSON array only. Each item must contain: latex (required), plain_text (optional). Do not include solutions.",
        messages: [
          {
            role: "user",
            content: `Concept focus: ${conceptTag}
Original problem: ${String(originalProblem.latex || "")}
Difficulty level (1-5): ${safeDifficulty}
Return exactly 3 problems.`,
          },
        ],
      });
      generatedProblems = parseModelArray(readFirstText(response.content));
    }

    if (generatedProblems.length === 0) {
      const fallbackLatex = String(originalProblem.latex || "").trim();
      generatedProblems = [
        { latex: fallbackLatex, plain_text: "" },
        { latex: fallbackLatex, plain_text: "" },
        { latex: fallbackLatex, plain_text: "" },
      ];
    }

    const normalized = generatedProblems
      .map((item) => ({
        latex: typeof item?.latex === "string" ? item.latex.trim() : "",
        plain_text:
          typeof item?.plain_text === "string" ? item.plain_text.trim() : "",
      }))
      .filter((item) => item.latex.length > 0)
      .slice(0, 3);

    while (normalized.length < 3) {
      normalized.push({
        latex: String(originalProblem.latex || "").trim(),
        plain_text: "",
      });
    }

    const difficulty = mapDifficulty(safeDifficulty);
    const inserted = await Promise.all(
      normalized.map((item) =>
        createMathPractice({
          userId,
          latex: item.latex,
          plainText: item.plain_text || undefined,
          problemType: String(originalProblem.problem_type || "other"),
          difficulty,
        })
      )
    );

    return NextResponse.json({
      problems: inserted.map((problem) => ({
        id: problem.id,
        latex: problem.latex,
        plain_text: problem.plain_text || "",
        difficulty: safeDifficulty,
        concept_tag: conceptTag,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to generate practice problems.",
      },
      { status: 500 }
    );
  }
}
