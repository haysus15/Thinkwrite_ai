import Anthropic from "@anthropic-ai/sdk";

export type SectionSource = {
  id: string;
  title: string;
  author: string | null;
  publication: string | null;
  year: number | null;
  notes: string | null;
  relevanceLevel: "strong" | "partial" | "weak" | "unrelated" | null;
  relevanceExplanation: string | null;
  evaluatedAt: string | null;
};

export type StudentDeclaration = {
  argument?: string;
  main_points?: string;
  assignment_understanding?: string;
};

export type SourceEvaluation = {
  relevanceLevel: "strong" | "partial" | "weak" | "unrelated";
  relevanceExplanation: string;
  sectionFit: string;
  gaps: string | null;
  suggestedUsage: string;
};

function getClaudeApiKey() {
  return process.env.CLAUDE_API_KEY || null;
}

function parseJson(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  const cleaned = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim()
    : trimmed;
  try {
    const parsed = JSON.parse(cleaned);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function extractText(content: Anthropic.Messages.ContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.Messages.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

export async function evaluateSource(
  source: SectionSource,
  sectionContent: string,
  sectionTitle: string,
  studentDeclaration: StudentDeclaration,
  paperArgument: string
): Promise<SourceEvaluation> {
  const fallback: SourceEvaluation = {
    relevanceLevel: "partial",
    relevanceExplanation:
      "This source may support part of the section, but the connection is not yet explicit.",
    sectionFit: "Map this source to one specific claim in the section.",
    gaps: "The relationship between source and thesis is still under-defined.",
    suggestedUsage: "Use one direct claim from the source and connect it to your section argument.",
  };

  const apiKey = getClaudeApiKey();
  if (!apiKey) {
    return fallback;
  }

  const anthropic = new Anthropic({ apiKey });
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 450,
    system: `You evaluate source relevance for student-authored outlines.
Do not suggest or name alternative sources.
Return JSON only in this shape:
{
  "relevanceLevel": "strong" | "partial" | "weak" | "unrelated",
  "relevanceExplanation": string,
  "sectionFit": string,
  "gaps": string | null,
  "suggestedUsage": string
}

Rules:
- Ground feedback in section argument and student declaration.
- Keep relevanceExplanation to 1-2 sentences.
- Never fabricate citation details.
- Never provide specific replacement source names.
- JSON only.`,
    messages: [
      {
        role: "user",
        content: `SOURCE:\n${JSON.stringify(source, null, 2)}\n\nSECTION TITLE:\n${
          sectionTitle
        }\n\nSECTION CONTENT:\n${sectionContent}\n\nSTUDENT DECLARATION:\n${JSON.stringify(
          studentDeclaration,
          null,
          2
        )}\n\nPAPER ARGUMENT:\n${paperArgument}`,
      },
    ],
  });

  const parsed = parseJson(extractText(response.content));
  if (!parsed) {
    return fallback;
  }

  const level =
    parsed.relevanceLevel === "strong" ||
    parsed.relevanceLevel === "partial" ||
    parsed.relevanceLevel === "weak" ||
    parsed.relevanceLevel === "unrelated"
      ? parsed.relevanceLevel
      : "partial";

  return {
    relevanceLevel: level,
    relevanceExplanation:
      typeof parsed.relevanceExplanation === "string" && parsed.relevanceExplanation.trim()
        ? parsed.relevanceExplanation.trim()
        : fallback.relevanceExplanation,
    sectionFit:
      typeof parsed.sectionFit === "string" && parsed.sectionFit.trim()
        ? parsed.sectionFit.trim()
        : fallback.sectionFit,
    gaps:
      typeof parsed.gaps === "string" && parsed.gaps.trim() ? parsed.gaps.trim() : null,
    suggestedUsage:
      typeof parsed.suggestedUsage === "string" && parsed.suggestedUsage.trim()
        ? parsed.suggestedUsage.trim()
        : fallback.suggestedUsage,
  };
}
