import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContextMemoryEntry, Json, MirrorChamber } from "@/lib/mirror-mode/subcategoryService";

export type ContextObservationPerson = {
  name: string;
  role?: string;
  company?: string;
  pronouns?: string;
};

export type ContextObservations = {
  people: ContextObservationPerson[];
  writing_type: string;
  relationship_direction: "upward" | "peer" | "downward" | "personal" | "unknown";
  tone_observed: string;
  recommended_chamber: MirrorChamber;
  recommended_subcategory: string;
  recommendation_confidence: "high" | "medium" | "low";
  recommendation_reasoning: string;
};

type ClaudeInput = {
  system: string;
  prompt: string;
  maxTokens: number;
};

type ClaudeDeps = {
  runClaude: (input: ClaudeInput) => Promise<string>;
};

const EXTRACTION_MODEL = "claude-haiku-4-5-20251001";
const URSIE_MESSAGE_MODEL = "claude-sonnet-4-20250514";

function getAnthropicClient() {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new Anthropic({ apiKey });
}

async function defaultRunClaude(input: ClaudeInput, model: string): Promise<string> {
  const anthropic = getAnthropicClient();
  if (!anthropic) {
    throw new Error("Claude API key not configured");
  }

  const response = await anthropic.messages.create({
    model,
    max_tokens: input.maxTokens,
    system: input.system,
    messages: [{ role: "user", content: input.prompt }],
  });

  return response.content?.map((part) => ("text" in part ? part.text : "")).join("\n").trim() || "";
}

function safeParseJson(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1)) as unknown;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function emptyObservations(): ContextObservations {
  return {
    people: [],
    writing_type: "",
    relationship_direction: "unknown",
    tone_observed: "",
    recommended_chamber: "general",
    recommended_subcategory: "",
    recommendation_confidence: "low",
    recommendation_reasoning: "",
  };
}

function isMirrorChamber(value: unknown): value is MirrorChamber {
  return value === "career" || value === "academic" || value === "creative" || value === "general";
}

function normalizePeople(value: unknown): ContextObservationPerson[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((person) => {
      if (!person || typeof person !== "object") {
        return null;
      }

      const record = person as Record<string, unknown>;
      const name = typeof record.name === "string" ? record.name.trim() : "";
      if (!name) {
        return null;
      }

      return {
        name,
        role: typeof record.role === "string" && record.role.trim() ? record.role.trim() : undefined,
        company:
          typeof record.company === "string" && record.company.trim() ? record.company.trim() : undefined,
        pronouns:
          typeof record.pronouns === "string" && record.pronouns.trim()
            ? record.pronouns.trim()
            : undefined,
      };
    })
    .filter((person) => person !== null) as ContextObservationPerson[];
}

function normalizeObservations(value: unknown): ContextObservations {
  if (!value || typeof value !== "object") {
    return emptyObservations();
  }

  const record = value as Record<string, unknown>;
  return {
    people: normalizePeople(record.people),
    writing_type: typeof record.writing_type === "string" ? record.writing_type.trim() : "",
    relationship_direction:
      record.relationship_direction === "upward" ||
      record.relationship_direction === "peer" ||
      record.relationship_direction === "downward" ||
      record.relationship_direction === "personal"
        ? record.relationship_direction
        : "unknown",
    tone_observed: typeof record.tone_observed === "string" ? record.tone_observed.trim() : "",
    recommended_chamber: isMirrorChamber(record.recommended_chamber)
      ? record.recommended_chamber
      : "general",
    recommended_subcategory:
      typeof record.recommended_subcategory === "string" ? record.recommended_subcategory.trim() : "",
    recommendation_confidence:
      record.recommendation_confidence === "high" ||
      record.recommendation_confidence === "medium" ||
      record.recommendation_confidence === "low"
        ? record.recommendation_confidence
        : "low",
    recommendation_reasoning:
      typeof record.recommendation_reasoning === "string" ? record.recommendation_reasoning.trim() : "",
  };
}

function buildExtractionPrompt(text: string, existingContext?: object) {
  return [
    "Writing sample:",
    text,
    existingContext ? `Existing context:\n${JSON.stringify(existingContext)}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildUrsieGenerationSystemPrompt() {
  return `
You are Ursie — a direct, stern mother-mentor. You are polite to the user's face, but clipped and no-nonsense.

Hard rules:
- Be concise, specific, and observant.
- Speak in first person.
- Do not sound like product marketing.
- Do not apologize.
- Reference the actual details you observed instead of speaking in abstractions.
- End with a clear but non-blocking nudge toward the queue.
`.trim();
}

function buildRecommendationPrompt(observations: ContextObservations) {
  const peopleSummary =
    observations.people.length > 0
      ? observations.people
          .map((person) =>
            [person.name, person.role, person.company].filter(Boolean).join(" · ")
          )
          .join(" | ")
      : "none";

  return [
    "Write one short Ursie message about a newly observed writing pattern.",
    "This is a generated recommendation, not a template.",
    `Observed people: ${peopleSummary}`,
    `Writing type: ${observations.writing_type || "unknown"}`,
    `Relationship direction: ${observations.relationship_direction}`,
    `Tone observed: ${observations.tone_observed || "unknown"}`,
    `Recommended chamber: ${observations.recommended_chamber}`,
    `Recommended subcategory: ${observations.recommended_subcategory || "none"}`,
    `Reasoning: ${observations.recommendation_reasoning || "none"}`,
    "Reference the specific details you saw. End by nudging the user toward the queue without sounding bureaucratic.",
  ].join("\n");
}

function buildPersonAttributes(person: ContextObservationPerson): Record<string, string> {
  const attributes: Record<string, string> = {};
  if (person.role) {
    attributes.role = person.role;
  }
  if (person.company) {
    attributes.company = person.company;
  }
  if (person.pronouns) {
    attributes.pronouns = person.pronouns;
  }
  return attributes;
}

function normalizeAttributeObject(value: Json): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const record = value as Record<string, Json | undefined>;
  return Object.entries(record).reduce<Record<string, string>>((acc, [key, entry]) => {
    if (typeof entry === "string" && entry.trim()) {
      acc[key] = entry;
    }
    return acc;
  }, {});
}

export async function extractContextObservationsWithDeps(
  text: string,
  existingContext: object | undefined,
  deps: ClaudeDeps
): Promise<ContextObservations> {
  try {
    const raw = await deps.runClaude({
      system: [
        "Extract structured context from the writing sample.",
        "Return JSON only.",
        "Do not generate new content.",
        "Use this shape exactly:",
        JSON.stringify(emptyObservations(), null, 2),
      ].join("\n"),
      prompt: buildExtractionPrompt(text, existingContext),
      maxTokens: 500,
    });

    return normalizeObservations(safeParseJson(raw));
  } catch {
    return emptyObservations();
  }
}

export async function extractContextObservations(
  text: string,
  existingContext?: object
): Promise<ContextObservations> {
  return extractContextObservationsWithDeps(text, existingContext, {
    runClaude: (input) => defaultRunClaude(input, EXTRACTION_MODEL),
  });
}

export async function generateUrsieRecommendationMessageWithDeps(
  observations: ContextObservations,
  userId: string,
  deps: ClaudeDeps
): Promise<string> {
  void userId;

  try {
    const response = await deps.runClaude({
      system: buildUrsieGenerationSystemPrompt(),
      prompt: buildRecommendationPrompt(observations),
      maxTokens: 180,
    });

    return response.trim() || "I caught enough in that piece to set aside for your queue. Look at it when you're ready.";
  } catch {
    return "I caught enough in that piece to set aside for your queue. Look at it when you're ready.";
  }
}

export async function generateUrsieRecommendationMessage(
  observations: ContextObservations,
  userId: string
): Promise<string> {
  return generateUrsieRecommendationMessageWithDeps(observations, userId, {
    runClaude: (input) => defaultRunClaude(input, URSIE_MESSAGE_MODEL),
  });
}

export async function saveContextMemory(
  userId: string,
  subcategoryId: string,
  observations: ContextObservations,
  supabase: SupabaseClient
): Promise<void> {
  if (observations.people.length === 0) {
    return;
  }

  for (const person of observations.people) {
    const name = person.name.trim();
    if (!name) {
      continue;
    }

    const { data: existing, error: lookupError } = await supabase
      .from("mirror_context_memory")
      .select("*")
      .eq("user_id", userId)
      .eq("subcategory_id", subcategoryId)
      .eq("entity_name", name)
      .maybeSingle();

    if (lookupError) {
      throw new Error(lookupError.message);
    }

    const nextAttributes = buildPersonAttributes(person);

    if (existing) {
      const { error: updateError } = await supabase
        .from("mirror_context_memory")
        .update({
          attributes: {
            ...normalizeAttributeObject((existing as ContextMemoryEntry).attributes),
            ...nextAttributes,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", (existing as ContextMemoryEntry).id)
        .eq("user_id", userId);

      if (updateError) {
        throw new Error(updateError.message);
      }

      continue;
    }

    const { error: insertError } = await supabase.from("mirror_context_memory").insert({
      user_id: userId,
      subcategory_id: subcategoryId,
      entity_type: "person",
      entity_name: name,
      attributes: nextAttributes,
    });

    if (insertError) {
      throw new Error(insertError.message);
    }
  }
}

export async function getContextMemoryForSubcategory(
  userId: string,
  subcategoryId: string,
  supabase: SupabaseClient
): Promise<ContextMemoryEntry[]> {
  const { data, error } = await supabase
    .from("mirror_context_memory")
    .select("*")
    .eq("user_id", userId)
    .eq("subcategory_id", subcategoryId)
    .order("entity_name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as ContextMemoryEntry[];
}

export async function updateContextMemoryEntry(
  entryId: string,
  attributes: object,
  supabase: SupabaseClient
): Promise<void> {
  const { error } = await supabase
    .from("mirror_context_memory")
    .update({
      attributes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", entryId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteContextMemoryEntry(
  entryId: string,
  userId: string,
  supabase: SupabaseClient
): Promise<void> {
  const { data: entry, error: lookupError } = await supabase
    .from("mirror_context_memory")
    .select("id, user_id")
    .eq("id", entryId)
    .maybeSingle();

  if (lookupError) {
    throw new Error(lookupError.message);
  }

  if (!entry || entry.user_id !== userId) {
    throw new Error("Context memory entry not found");
  }

  const { error: deleteError } = await supabase
    .from("mirror_context_memory")
    .delete()
    .eq("id", entryId)
    .eq("user_id", userId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }
}
