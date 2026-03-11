import Anthropic from "@anthropic-ai/sdk";

export type SourceRequirements = {
  sourcesRequired: boolean;
  minimumCount: number | null;
  sourceTypes: string[];
  citationFormat: string | null;
  detected_from: "requirements" | "declaration" | "both" | "none";
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

export async function detectSourceRequirements(
  assignmentRequirements: Record<string, unknown> | null,
  studentDeclaration: string,
  paperType: string | null
): Promise<SourceRequirements> {
  const fallback: SourceRequirements = {
    sourcesRequired: false,
    minimumCount: null,
    sourceTypes: [],
    citationFormat: null,
    detected_from: "none",
  };

  const apiKey = getClaudeApiKey();
  if (!apiKey) {
    return fallback;
  }

  const anthropic = new Anthropic({ apiKey });
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 350,
    system: `You classify source requirements for academic assignments.
Return JSON only with this exact shape:
{
  "sourcesRequired": boolean,
  "minimumCount": number | null,
  "sourceTypes": string[],
  "citationFormat": string | null,
  "detected_from": "requirements" | "declaration" | "both" | "none"
}

Rules:
- Infer sourcesRequired true if requirements/declaration indicate references, citations, research, or evidence from outside materials.
- minimumCount should be null if not explicitly inferable.
- citationFormat must be one of APA, MLA, Chicago, or null.
- sourceTypes should be generic categories only, never specific source names.
- JSON only, no prose.`,
    messages: [
      {
        role: "user",
        content: `ASSIGNMENT REQUIREMENTS JSON:\n${JSON.stringify(
          assignmentRequirements || {},
          null,
          2
        )}\n\nSTUDENT DECLARATION:\n${studentDeclaration || ""}\n\nPAPER TYPE:\n${
          paperType || ""
        }`,
      },
    ],
  });

  const raw = extractText(response.content);
  const parsed = parseJson(raw);
  if (!parsed) {
    return fallback;
  }

  return {
    sourcesRequired: Boolean(parsed.sourcesRequired),
    minimumCount:
      typeof parsed.minimumCount === "number" && Number.isFinite(parsed.minimumCount)
        ? parsed.minimumCount
        : null,
    sourceTypes: Array.isArray(parsed.sourceTypes)
      ? parsed.sourceTypes
          .map((item) => String(item || "").trim())
          .filter(Boolean)
      : [],
    citationFormat:
      typeof parsed.citationFormat === "string" && parsed.citationFormat.trim()
        ? parsed.citationFormat.trim()
        : null,
    detected_from:
      parsed.detected_from === "requirements" ||
      parsed.detected_from === "declaration" ||
      parsed.detected_from === "both" ||
      parsed.detected_from === "none"
        ? parsed.detected_from
        : "none",
  };
}
