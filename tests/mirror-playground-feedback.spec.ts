import { expect, test } from "playwright/test";
import { NextRequest } from "next/server.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { handlePlaygroundFeedback } from "@/app/api/mirror/playground/feedback/handler";

type SessionRecord = {
  id: string;
  user_id: string;
  generation_request: Record<string, unknown>;
  voiced_output: string | null;
  feedback_signals: unknown[];
  messages?: unknown[];
};

type FeedbackRecord = Record<string, unknown>;

class PlaygroundFeedbackSupabase {
  sessions = new Map<string, SessionRecord>();
  voiceChambers = new Map<string, Record<string, unknown>>();
  feedbackLogs: FeedbackRecord[] = [];
  failLogWrite = false;
  mirrorDocumentWrites = 0;

  from(table: string) {
    if (table === "mirror_playground_sessions") {
      const self = this;
      let filters: Array<{ column: string; value: string }> = [];
      return {
        select() {
          const query = {
            eq(column: string, value: string) {
              filters.push({ column, value });
              return query;
            },
            async maybeSingle() {
              const row =
                Array.from(self.sessions.values()).find((session) =>
                  filters.every(
                    (filter) => String((session as Record<string, unknown>)[filter.column]) === filter.value
                  )
                ) || null;
              return { data: row, error: null };
            },
          };
          return query;
        },
        update(values: Record<string, unknown>) {
          return {
            eq(column: string, value: string) {
              filters.push({ column, value });
              const query = {
                eq(nextColumn: string, nextValue: string) {
                  filters.push({ column: nextColumn, value: nextValue });
                  return query;
                },
                then(
                  resolve: (value: { error: null }) => unknown,
                  reject?: (reason?: unknown) => unknown
                ) {
                  for (const session of self.sessions.values()) {
                    if (
                      filters.every(
                        (filter) => String((session as Record<string, unknown>)[filter.column]) === filter.value
                      )
                    ) {
                      Object.assign(session, values);
                    }
                  }
                  return Promise.resolve({ error: null }).then(resolve, reject);
                },
              };
              return query;
            },
          };
        },
      };
    }

    if (table === "voice_chambers") {
      const self = this;
      let userId = "";
      let chamber = "";
      return {
        select() {
          const query = {
            eq(column: string, value: string) {
              if (column === "user_id") userId = value;
              if (column === "chamber") chamber = value;
              return query;
            },
            async maybeSingle() {
              return { data: self.voiceChambers.get(`${userId}:${chamber}`) || null, error: null };
            },
          };
          return query;
        },
      };
    }

    if (table === "mirror_playground_feedback") {
      const self = this;
      return {
        async insert(payload: Record<string, unknown>) {
          if (self.failLogWrite) {
            return { error: { message: "log offline" } };
          }
          self.feedbackLogs.push(payload);
          return { error: null };
        },
      };
    }

    if (table === "mirror_documents") {
      const self = this;
      return {
        async insert() {
          self.mirrorDocumentWrites += 1;
          return { error: null };
        },
      };
    }

    throw new Error(`Unexpected table ${table}`);
  }
}

function buildRequest(whatFeltOff: "tone" | "word_choices" | "structure") {
  return new NextRequest("http://localhost:3000/api/mirror/playground/feedback", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      session_id: "session-1",
      what_felt_off: whatFeltOff,
      original_output: "Original voiced output that felt wrong.",
      chamber: "academic",
    }),
  });
}

function seedSupabase() {
  const supabase = new PlaygroundFeedbackSupabase();
  supabase.sessions.set("session-1", {
    id: "session-1",
    user_id: "user-1",
    generation_request: {
      audience: "Professor Allen",
      purpose: "Ask for one extra day",
      tone: "direct but respectful",
      content: "I need to explain why the evidence section still needs revision.",
      enrichment: { relationship: "advisor", user_name: "Morgan" },
    },
    voiced_output: "Original voiced output that felt wrong.",
    feedback_signals: [],
    messages: [
      {
        id: "m-1",
        role: "user",
        text: "I need to ask Professor Allen for one extra day on the revision.",
      },
    ],
  });
  supabase.voiceChambers.set("user-1:academic", {
    aggregate_fingerprint: {
      rhythm: { avgSentenceLength: 14, sentenceVariation: 5, shortSentenceRatio: 0.2 },
      vocabulary: { complexWordRatio: 0.12, contractionRatio: 0.02, topWords: ["argument", "evidence"] },
      voice: {
        formalityScore: 0.58,
        assertiveDensity: 0.01,
        hedgeDensity: 0.004,
        personalPronounRate: 0.03,
        activeVoiceRatio: 0.8,
      },
      punctuation: { exclamationRate: 0, questionRate: 0, dashRate: 0, semicolonRate: 0, ellipsisRate: 0 },
      rhetoric: { transitionWordRate: 0.1, questionOpenerRate: 0, listUsageRate: 0, exampleUsageRate: 0 },
    },
    confidence_level: 62,
  });
  return supabase;
}

test.describe("mirror playground feedback", () => {
  test("feedback logged to mirror_playground_feedback with all required fields", async () => {
    const supabase = seedSupabase();

    const response = await handlePlaygroundFeedback(buildRequest("tone"), {
      resolveUserId: async () => "user-1",
      createSupabaseServerClient: () => supabase as unknown as SupabaseClient,
      runClaude: async ({ prompt }) =>
        prompt.includes("Write Ursie's response before she fixes the draft.")
          ? "Morgan. I heard Professor Allen and pushed the formality too hard."
          : "Regenerated voiced output",
    });

    expect(response.status).toBe(200);
    expect(supabase.feedbackLogs).toHaveLength(1);
    expect(supabase.feedbackLogs[0]).toMatchObject({
      user_id: "user-1",
      session_id: "session-1",
      feedback_type: "not_my_voice",
      what_felt_off: "tone",
      original_output: "Original voiced output that felt wrong.",
      regenerated_output: "Regenerated voiced output",
      chamber: "academic",
    });
  });

  test("regeneration triggered immediately on feedback", async () => {
    const supabase = seedSupabase();
    let callCount = 0;

    const response = await handlePlaygroundFeedback(buildRequest("tone"), {
      resolveUserId: async () => "user-1",
      createSupabaseServerClient: () => supabase as unknown as SupabaseClient,
      runClaude: async ({ prompt }) => {
        callCount += 1;
        return prompt.includes("Write Ursie's response before she fixes the draft.")
          ? "Morgan. I heard Professor Allen and pushed the formality too hard."
          : "Regenerated voiced output";
      },
    });

    expect(response.status).toBe(200);
    expect(callCount).toBe(2);
  });

  test("regeneration prompt adjusted correctly per feedback type", async () => {
    const supabase = seedSupabase();
    const prompts: string[] = [];

    for (const feedbackType of ["tone", "word_choices", "structure"] as const) {
      await handlePlaygroundFeedback(buildRequest(feedbackType), {
        resolveUserId: async () => "user-1",
        createSupabaseServerClient: () => supabase as unknown as SupabaseClient,
        runClaude: async ({ prompt }) => {
          prompts.push(prompt);
          return prompt.includes("Write Ursie's response before she fixes the draft.")
            ? `Morgan. ${feedbackType}.`
            : `regenerated-${feedbackType}`;
        },
      });
    }

    const regenerationPrompts = prompts.filter((prompt) =>
      prompt.includes("Write only the revised final draft.")
    );

    expect(regenerationPrompts[0]).toContain("Explicitly avoid the tone of the original output.");
    expect(regenerationPrompts[1]).toContain(
      "Replace formal or generic vocabulary with the user's characteristic word patterns."
    );
    expect(regenerationPrompts[2]).toContain(
      "Restructure the draft using the user's characteristic sentence length, paragraph rhythm, and opening or closing patterns."
    );
  });

  test("regenerated output stored on session record replacing original voiced output", async () => {
    const supabase = seedSupabase();

    await handlePlaygroundFeedback(buildRequest("structure"), {
      resolveUserId: async () => "user-1",
      createSupabaseServerClient: () => supabase as unknown as SupabaseClient,
      runClaude: async ({ prompt }) =>
        prompt.includes("Write Ursie's response before she fixes the draft.")
          ? "Morgan. The way it was built."
          : "New voiced output",
    });

    expect(supabase.sessions.get("session-1")?.voiced_output).toBe("New voiced output");
    expect(supabase.sessions.get("session-1")?.feedback_signals).toHaveLength(1);
  });

  test("log write failure does not fail the request", async () => {
    const supabase = seedSupabase();
    supabase.failLogWrite = true;

    const response = await handlePlaygroundFeedback(buildRequest("word_choices"), {
      resolveUserId: async () => "user-1",
      createSupabaseServerClient: () => supabase as unknown as SupabaseClient,
      runClaude: async ({ prompt }) =>
        prompt.includes("Write Ursie's response before she fixes the draft.")
          ? "Morgan. The vocabulary. Got it."
          : "Recovered voiced output",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      regenerated_output: "Recovered voiced output",
    });
  });

  test("regenerated output is never ingested", async () => {
    const supabase = seedSupabase();

    await handlePlaygroundFeedback(buildRequest("tone"), {
      resolveUserId: async () => "user-1",
      createSupabaseServerClient: () => supabase as unknown as SupabaseClient,
      runClaude: async ({ prompt }) =>
        prompt.includes("Write Ursie's response before she fixes the draft.")
          ? "Morgan. I heard the relationship one way and pushed it too far."
          : "Regenerated voiced output",
    });

    expect(supabase.mirrorDocumentWrites).toBe(0);
  });
});
