import OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";

export type StruggleType =
  | "misconception"
  | "recall_gap"
  | "reasoning_gap"
  | "incomplete_understanding";

export type StrugglePayload = {
  userId: string;
  assignmentId: string | null;
  className: string;
  struggleType: StruggleType;
  sessionNotes: string | null;
  studentMessages: string[];
};

function sanitizeConceptLabel(raw: string): string {
  const normalized = raw
    .replace(/[\n\r\t]+/g, " ")
    .replace(/["'`]/g, "")
    .trim();
  if (!normalized) return "core concept";

  const words = normalized.split(/\s+/).filter(Boolean);
  return words.slice(0, 8).join(" ");
}

async function extractConceptLabel(studentMessages: string[]): Promise<string> {
  const joined = studentMessages
    .map((message) => message.trim())
    .filter(Boolean)
    .slice(-2)
    .join("\n\n");

  if (!joined) return "core concept";

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return "core concept";

  try {
    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "In 3-8 words, name the academic concept this student is struggling with. Return plain text only.",
        },
        {
          role: "user",
          content: joined,
        },
      ],
    });

    const label = response.choices[0]?.message?.content ?? "";
    return sanitizeConceptLabel(label);
  } catch {
    return "core concept";
  }
}

export async function logConceptStruggle(
  supabase: SupabaseClient,
  payload: StrugglePayload
): Promise<void> {
  const className = payload.className.trim();
  if (!className) {
    throw new Error("className is required to log concept struggle.");
  }

  const concept = await extractConceptLabel(payload.studentMessages);

  const insertPayload = {
    user_id: payload.userId,
    assignment_id: payload.assignmentId,
    class_name: className,
    concept,
    struggle_type: payload.struggleType,
    session_notes: payload.sessionNotes,
    resolved: false,
  };

  const { error } = await supabase.from("concept_struggles").insert(insertPayload);
  if (error) {
    throw new Error(error.message || "Failed to log concept struggle.");
  }
}
