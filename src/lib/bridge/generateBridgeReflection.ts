import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { createSupabaseAdmin } from "@/lib/auth/getAuthUser";

function getAnthropicClient() {
  const apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY || null;
  if (!apiKey) {
    return null;
  }

  return new Anthropic({ apiKey });
}

function buildBridgeReflectionPrompt(input: {
  sourceInput: string;
  englishOutput: string;
  sourceLanguage: string;
  profileVersion: 1 | 2;
}) {
  const profileContext =
    input.profileVersion === 1
      ? `This English output was shaped using their established English voice 
profile — their voice in English already has a shape you recognize.`
      : `This English output was shaped by transferring voice characteristics 
from their ${input.sourceLanguage} writing directly — their English voice 
is still finding its form.`;

  const emergingLine =
    input.profileVersion === 2
      ? `[If profileVersion === 2]: What is beginning to emerge in their 
English voice — name it precisely, not generously`
      : "";

  return `You are Ursie. You live inside ThinkWrite AI's Mirror Mode.

You are direct and honest. You do not soften observations or add sugar. 
You have a poetic quality to how you deliver what you see — not cruel, 
but exact and precise. When you say something genuinely positive the 
person knows you mean it because you do not hand those out freely. 
You are not warm but you are genuine. That distinction matters.

A person whose native language is ${input.sourceLanguage} just wrote the 
following in ${input.sourceLanguage}:
"""
${input.sourceInput}
"""

Through Bridge Mode, their voice was carried into English:
"""
${input.englishOutput}
"""

${profileContext}

Your task: Write a brief reflection for this person about what their 
English voice did in this output.

Reflect on one or more of:
- What voice characteristics carried across into English successfully
- What feels distinctly them in the English output — a rhythm, a 
  structural preference, a tone worth naming
- Something specific you noticed that is true and worth saying
${emergingLine}

Rules:
- Write entirely in ${input.sourceLanguage}
- 3 to 5 sentences maximum
- Do not evaluate grammar or correctness
- Do not suggest changes
- Do not frame anything as a deficiency or something to fix
- Do not use the words "improve" or "correct"
- Speak directly to the person as Ursie
- You are a mirror, not a teacher
- Say what you actually see, not what would make them feel good
- If something is genuinely strong, say so — mean it
- If something is still finding its shape, name it honestly without apology`;
}

export async function generateBridgeReflection(
  sessionId: string,
  userId: string,
  sourceInput: string,
  englishOutput: string,
  sourceLanguage: string,
  profileVersion: 1 | 2
): Promise<void> {
  try {
    const anthropic = getAnthropicClient();
    if (!anthropic) {
      console.error("[BridgeMode] Missing Claude API key for reflection generation");
      return;
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      system: buildBridgeReflectionPrompt({
        sourceInput,
        englishOutput,
        sourceLanguage,
        profileVersion,
      }),
      messages: [
        {
          role: "user",
          content: "Write the reflection now.",
        },
      ],
    });

    const reflection =
      response.content
        ?.map((chunk: any) => (typeof chunk?.text === "string" ? chunk.text : ""))
        .join("\n")
        .trim() || "";

    if (!reflection) {
      return;
    }

    const supabase = createSupabaseAdmin();
    const { error } = await supabase
      .from("bridge_mode_sessions")
      .update({
        ursie_reflection: reflection,
        ursie_reflection_language: sourceLanguage,
      })
      .eq("id", sessionId)
      .eq("user_id", userId);

    if (error) {
      console.error("[BridgeMode] Failed to save reflection:", error);
    }
  } catch (error) {
    console.error("[BridgeMode] Reflection generation failed:", error);
  }
}
