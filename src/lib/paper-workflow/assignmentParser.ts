import Anthropic from "@anthropic-ai/sdk";

export type ParsedAssignmentPrompt = {
  order: number;
  raw_text: string;
  prompt_type:
    | "essay"
    | "short_response"
    | "analysis"
    | "reflection"
    | "creative"
    | "other";
  word_count_hint: number | null;
};

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

function fallbackParse(text: string): ParsedAssignmentPrompt[] {
  const cleaned = String(text || "").trim();
  if (!cleaned) return [];
  const segments = cleaned
    .split(/\n(?=\s*(?:\d+[\).\s]|[a-zA-Z][\).\s]|[-*]\s))/)
    .map((line) => line.trim())
    .filter(Boolean);

  return segments.map((segment, index) => ({
    order: index + 1,
    raw_text: segment,
    prompt_type: "other",
    word_count_hint: null,
  }));
}

function normalizePrompts(raw: unknown): ParsedAssignmentPrompt[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((prompt, index) => {
      if (!prompt || typeof prompt !== "object") return null;
      const row = prompt as Record<string, unknown>;
      const rawText = String(row.raw_text || "").trim();
      if (!rawText) return null;
      const type = String(row.prompt_type || "other");
      const promptType: ParsedAssignmentPrompt["prompt_type"] =
        type === "essay" ||
        type === "short_response" ||
        type === "analysis" ||
        type === "reflection" ||
        type === "creative"
          ? type
          : "other";

      const wordHint =
        row.word_count_hint == null || Number.isNaN(Number(row.word_count_hint))
          ? null
          : Number(row.word_count_hint);

      return {
        order: row.order == null || Number.isNaN(Number(row.order)) ? index + 1 : Number(row.order),
        raw_text: rawText,
        prompt_type: promptType,
        word_count_hint: wordHint,
      };
    })
    .filter((prompt): prompt is ParsedAssignmentPrompt => Boolean(prompt))
    .sort((a, b) => a.order - b.order)
    .map((prompt, index) => ({ ...prompt, order: index + 1 }));
}

export async function parseAssignmentPrompts(input: {
  text: string;
  apiKey?: string | null;
}): Promise<ParsedAssignmentPrompt[]> {
  const text = String(input.text || "").trim();
  if (!text) return [];

  if (!input.apiKey) {
    return fallbackParse(text);
  }

  try {
    const anthropic = new Anthropic({ apiKey: input.apiKey });
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1800,
      system: `The following text was extracted from a writing assignment sheet or rubric.
Identify each individual writing prompt, question, or task the student must complete.
Each prompt is typically numbered, lettered, or separated by a line break.
Return JSON only:
{
  "prompts": [
    {
      "order": 1,
      "raw_text": "the prompt exactly as written",
      "prompt_type": "essay | short_response | analysis | reflection | creative | other",
      "word_count_hint": null or integer if specified in the prompt
    }
  ]
}
Do not include instructions, headers, rubric criteria, or non-prompt text.
If a prompt has multiple parts (a, b, c), treat each part as a separate prompt.`,
      messages: [{ role: "user", content: text }],
    });

    const parsed = parseModelJson(readFirstText(response.content) || "{}");
    const prompts = normalizePrompts(parsed?.prompts);
    if (prompts.length > 0) return prompts;
    return fallbackParse(text);
  } catch {
    return fallbackParse(text);
  }
}
