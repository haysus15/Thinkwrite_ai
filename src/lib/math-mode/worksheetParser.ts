import Anthropic from "@anthropic-ai/sdk";

export type ParsedWorksheetProblem = {
  order: number;
  raw_text: string;
  latex: string | null;
  problem_type:
    | "algebra"
    | "calculus"
    | "geometry"
    | "arithmetic"
    | "statistics"
    | "other";
};

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

function parseModelJson(text: string) {
  const direct = safeJsonParse(text);
  if (direct) return direct;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    const parsed = safeJsonParse(fenced[1].trim());
    if (parsed) return parsed;
  }
  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch?.[0]) {
    const parsed = safeJsonParse(objectMatch[0]);
    if (parsed) return parsed;
  }
  return null;
}

function fallbackParse(text: string): ParsedWorksheetProblem[] {
  const cleaned = String(text || "").trim();
  if (!cleaned) return [];
  const segments = cleaned
    .split(/\n(?=\s*(?:\d+[\).\s]|[a-zA-Z][\).\s]))/)
    .map((line) => line.trim())
    .filter(Boolean);
  return segments.map((segment, index) => ({
    order: index + 1,
    raw_text: segment,
    latex: null,
    problem_type: "other",
  }));
}

function normalizeProblems(raw: unknown): ParsedWorksheetProblem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((problem, index) => {
      if (!problem || typeof problem !== "object") return null;
      const row = problem as Record<string, unknown>;
      const rawText = String(row.raw_text || "").trim();
      if (!rawText) return null;
      const type = String(row.problem_type || "other");
      const normalizedType: ParsedWorksheetProblem["problem_type"] =
        type === "algebra" ||
        type === "calculus" ||
        type === "geometry" ||
        type === "arithmetic" ||
        type === "statistics"
          ? type
          : "other";
      return {
        order:
          row.order == null || Number.isNaN(Number(row.order))
            ? index + 1
            : Number(row.order),
        raw_text: rawText,
        latex:
          row.latex == null || String(row.latex).trim() === ""
            ? null
            : String(row.latex),
        problem_type: normalizedType,
      };
    })
    .filter((problem): problem is ParsedWorksheetProblem => Boolean(problem))
    .sort((a, b) => a.order - b.order)
    .map((problem, index) => ({ ...problem, order: index + 1 }));
}

export async function parseWorksheetText(input: {
  text: string;
  apiKey?: string | null;
}) {
  const text = String(input.text || "").trim();
  if (!text) return [] as ParsedWorksheetProblem[];

  if (!input.apiKey) {
    return fallbackParse(text);
  }

  try {
    const anthropic = new Anthropic({ apiKey: input.apiKey });
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1600,
      system: `The following text was extracted from a math worksheet or assignment.
Identify each individual math problem. Each problem is typically numbered or lettered.
Return JSON only:
{
  "problems": [
    {
      "order": 1,
      "raw_text": "the problem exactly as written",
      "latex": "LaTeX representation if detectable, otherwise null",
      "problem_type": "algebra | calculus | geometry | arithmetic | statistics | other"
    }
  ]
}
Do not include instructions, headers, or non-problem text.
If a problem has multiple parts (a, b, c), treat each part as a separate problem.`,
      messages: [{ role: "user", content: text }],
    });
    const parsed = parseModelJson(readFirstText(response.content) || "{}");
    const problems = normalizeProblems(parsed?.problems);
    if (problems.length > 0) return problems;
    return fallbackParse(text);
  } catch {
    return fallbackParse(text);
  }
}
