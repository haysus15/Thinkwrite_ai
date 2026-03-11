import OpenAI from "openai";
import type { MisconceptionLevel } from "./victorTypes";
import type { CoachingProfile } from "./coachingProfiles";

export async function detectMisconception(
  studentMessage: string
): Promise<MisconceptionLevel> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !studentMessage.trim()) return "none";

  try {
    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            'Classify whether this student response demonstrates: none (clear understanding or reasonable attempt), partial (some understanding but a specific gap), or fundamental (core misunderstanding). Return JSON only: {"level":"none|partial|fundamental"}.',
        },
        { role: "user", content: studentMessage },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "";
    const parsed = JSON.parse(raw) as { level?: string };
    if (parsed.level === "partial" || parsed.level === "fundamental") {
      return parsed.level;
    }
    return "none";
  } catch {
    return "none";
  }
}

export function buildMisconceptionInstruction(
  level: MisconceptionLevel,
  profile: CoachingProfile
): string {
  if (level === "none") return "";

  if (profile === "fast_review" && level === "partial") {
    return "The student has a minor gap. Flag it directly and briefly without extended scaffolding.";
  }

  if (profile === "critic") {
    return "The student has made an error. Challenge them to find it themselves before you name it.";
  }

  if (level === "fundamental") {
    return "The student has a fundamental misunderstanding. Step back to first principles regardless of selected mode.";
  }

  return "The student has a partial gap. Identify it specifically and ask a scaffolded question to guide them.";
}
