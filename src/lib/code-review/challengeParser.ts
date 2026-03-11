import Anthropic from "@anthropic-ai/sdk";

export type ParsedCodeChallenge = {
  order: number;
  raw_text: string;
  challenge_type:
    | "algorithm"
    | "data_structure"
    | "debugging"
    | "implementation"
    | "design"
    | "other";
  language_hint: string | null;
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

function fallbackParse(text: string): ParsedCodeChallenge[] {
  const cleaned = String(text || "").trim();
  if (!cleaned) return [];
  const segments = cleaned
    .split(/\n(?=\s*(?:\d+[\).\s]|[a-zA-Z][\).\s]|[-*]\s))/)
    .map((line) => line.trim())
    .filter(Boolean);

  return segments.map((segment, index) => ({
    order: index + 1,
    raw_text: segment,
    challenge_type: "other",
    language_hint: null,
  }));
}

function normalizeChallenges(raw: unknown): ParsedCodeChallenge[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((challenge, index) => {
      if (!challenge || typeof challenge !== "object") return null;
      const row = challenge as Record<string, unknown>;
      const rawText = String(row.raw_text || "").trim();
      if (!rawText) return null;
      const type = String(row.challenge_type || "other");
      const challengeType: ParsedCodeChallenge["challenge_type"] =
        type === "algorithm" ||
        type === "data_structure" ||
        type === "debugging" ||
        type === "implementation" ||
        type === "design"
          ? type
          : "other";

      const languageHint =
        row.language_hint == null || String(row.language_hint).trim() === ""
          ? null
          : String(row.language_hint).trim();

      return {
        order: row.order == null || Number.isNaN(Number(row.order)) ? index + 1 : Number(row.order),
        raw_text: rawText,
        challenge_type: challengeType,
        language_hint: languageHint,
      };
    })
    .filter((challenge): challenge is ParsedCodeChallenge => Boolean(challenge))
    .sort((a, b) => a.order - b.order)
    .map((challenge, index) => ({ ...challenge, order: index + 1 }));
}

export async function parseCodeChallenges(input: {
  text: string;
  apiKey?: string | null;
}): Promise<ParsedCodeChallenge[]> {
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
      system: `The following text was extracted from a coding assignment or challenge sheet.
Identify each individual coding challenge, task, or problem the student must complete.
Each challenge is typically numbered, lettered, or clearly separated.
Return JSON only:
{
  "challenges": [
    {
      "order": 1,
      "raw_text": "the challenge description exactly as written",
      "challenge_type": "algorithm | data_structure | debugging | implementation | design | other",
      "language_hint": null or string if a specific language is mentioned
    }
  ]
}
Do not include general instructions, setup steps, or submission guidelines.
If a challenge has multiple sub-tasks (a, b, c), treat each sub-task as a separate challenge.`,
      messages: [{ role: "user", content: text }],
    });

    const parsed = parseModelJson(readFirstText(response.content) || "{}");
    const challenges = normalizeChallenges(parsed?.challenges);
    if (challenges.length > 0) return challenges;
    return fallbackParse(text);
  } catch {
    return fallbackParse(text);
  }
}
