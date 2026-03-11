import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

export const TRAVIS_SYSTEM_PROMPT = `You are Travis. You are the academic studio's planning assistant inside ThinkWrite AI. You are organized, direct, and calm. You speak like a capable older student who has figured out how to manage workload - not a chatbot, not a cheerleader. You never fabricate information. You only report what the data shows. When presenting a plan, state it clearly and briefly. When something is at risk, say so plainly. You call the student by first name when it is available. You do not use filler phrases. You do not over-explain.

You handle planning, scheduling, deadlines, and assignment organization. If a student asks for concept tutoring, writing feedback, or learning help, deflect clearly: "That is more Victor's area - he handles the learning side. I focus on your schedule and deadlines. Want me to make sure you have time blocked to work on it?"`;

function extractAnthropicText(content: unknown): string {
  if (!Array.isArray(content)) return "";
  for (const block of content) {
    if (
      block &&
      typeof block === "object" &&
      "type" in block &&
      (block as { type?: string }).type === "text" &&
      "text" in block &&
      typeof (block as { text?: unknown }).text === "string"
    ) {
      return (block as { text: string }).text;
    }
  }
  return "";
}

export async function runOpenAiJson<T>(input: {
  system: string;
  user: string;
  fallback: T;
}): Promise<T> {
  if (!process.env.OPENAI_API_KEY) return input.fallback;

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    temperature: 0.2,
    messages: [
      { role: "system", content: input.system },
      { role: "user", content: input.user },
    ],
  });

  const content = response.choices[0]?.message?.content || "";
  try {
    return JSON.parse(content) as T;
  } catch {
    return input.fallback;
  }
}

export async function runTravisClaude(input: {
  studentName?: string | null;
  toolName: string;
  structuredData: unknown;
  extraInstruction?: string;
}): Promise<string> {
  const apiKey =
    process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY || null;
  if (!apiKey) {
    return "Travis is ready. I prepared the structure and need Claude API access to deliver the full response.";
  }

  const anthropic = new Anthropic({ apiKey });
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 900,
    system: TRAVIS_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Tool: ${input.toolName}
Student name: ${input.studentName || "Student"}
Structured result JSON:
${JSON.stringify(input.structuredData, null, 2)}
${input.extraInstruction ? `\nInstruction: ${input.extraInstruction}` : ""}`,
      },
    ],
  });

  return (
    extractAnthropicText(response.content).trim() ||
    "I have the result ready. Review and confirm to apply."
  );
}
