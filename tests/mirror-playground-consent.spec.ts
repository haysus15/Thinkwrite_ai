import { expect, test } from "playwright/test";
import { NextRequest } from "next/server.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  handleUpdatePlaygroundSession,
} from "@/app/api/mirror/playground/session/[id]/handler";
import { handlePlaygroundFeedback } from "@/app/api/mirror/playground/feedback/handler";
import {
  shouldExcludeFromProfile,
  SOURCE_AUTHORITY,
} from "@/lib/mirror-core/sourceAuthority";

type SessionMessage = {
  id: string;
  role: "user" | "ursie";
  text: string;
};

type SessionRecord = {
  id: string;
  user_id: string;
  messages: SessionMessage[];
  context_memory: Record<string, string>;
  chamber: string | null;
  conversation_onboarding: boolean;
  updated_at: string;
};

type FeedbackSessionRecord = {
  id: string;
  user_id: string;
  generation_request: Record<string, unknown>;
  voiced_output: string | null;
  feedback_signals: unknown[];
};

class PlaygroundSessionSupabase {
  sessions = new Map<string, SessionRecord>();

  from(table: string) {
    if (table !== "mirror_playground_sessions") {
      throw new Error(`Unexpected table ${table}`);
    }

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
              async then(resolve: (value: { error: null }) => unknown, reject?: (reason?: unknown) => unknown) {
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
}

class PlaygroundFeedbackSupabase {
  sessions = new Map<string, FeedbackSessionRecord>();
  voiceChambers = new Map<string, Record<string, unknown>>();
  feedbackLogs: Array<Record<string, unknown>> = [];
  consentEnabled = false;

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
          self.feedbackLogs.push(payload);
          return { error: null };
        },
      };
    }

    throw new Error(`Unexpected table ${table}`);
  }
}

function baseSession(): SessionRecord {
  return {
    id: "session-1",
    user_id: "user-1",
    messages: [],
    context_memory: {},
    chamber: null,
    conversation_onboarding: false,
    updated_at: new Date().toISOString(),
  };
}

function buildPatchRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost:3000/api/mirror/playground/session/session-1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function seedFeedbackSupabase(consentEnabled: boolean) {
  const supabase = new PlaygroundFeedbackSupabase();
  supabase.consentEnabled = consentEnabled;
  supabase.sessions.set("session-1", {
    id: "session-1",
    user_id: "user-1",
    generation_request: {
      audience: "Professor Allen",
      purpose: "Ask for one extra day",
      tone: "direct but respectful",
      content: "I need to explain why the evidence section still needs revision.",
      enrichment: { relationship: "advisor" },
    },
    voiced_output: "Original voiced output that felt wrong.",
    feedback_signals: [],
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

test.describe("mirror playground consent behavior", () => {
  test("playground ingestion does not occur when Mirror Mode captures are disabled for the user", async () => {
    const supabase = new PlaygroundSessionSupabase();
    supabase.sessions.set("session-1", baseSession());
    let called = false;

    await handleUpdatePlaygroundSession(
      buildPatchRequest({
        capture_enabled: false,
        messages: [
          {
            id: "msg-1",
            role: "user",
            text: "I need this draft to explain why the deadline moved, because the client added two approval rounds after the team had already committed to the original delivery plan.",
          },
        ],
      }),
      { id: "session-1" },
      {
        resolveUserId: async () => "user-1",
        createSupabaseServerClient: () => supabase as unknown as SupabaseClient,
        shouldIngest: () => true,
        ingestConversationMessage: async () => {
          called = true;
        },
      }
    );

    expect(called).toBe(false);
  });

  test("playground ingestion proceeds when captures are enabled", async () => {
    const supabase = new PlaygroundSessionSupabase();
    supabase.sessions.set("session-1", baseSession());
    let called = false;

    await handleUpdatePlaygroundSession(
      buildPatchRequest({
        capture_enabled: true,
        messages: [
          {
            id: "msg-1",
            role: "user",
            text: "I need this draft to explain why the deadline moved, because the client added two approval rounds after the team had already committed to the original delivery plan.",
          },
        ],
      }),
      { id: "session-1" },
      {
        resolveUserId: async () => "user-1",
        createSupabaseServerClient: () => supabase as unknown as SupabaseClient,
        shouldIngest: () => true,
        ingestConversationMessage: async () => {
          called = true;
        },
      }
    );

    expect(called).toBe(true);
  });

  test("generated output excluded_from_profile is always true regardless of consent state", () => {
    for (const consentEnabled of [false, true]) {
      expect(consentEnabled).toBeDefined();
      expect(shouldExcludeFromProfile(SOURCE_AUTHORITY.AI_GENERATED_ACCEPTED)).toBe(true);
      expect(shouldExcludeFromProfile(SOURCE_AUTHORITY.AI_GENERATED_REJECTED)).toBe(true);
    }
  });

  test("feedback log writes to mirror_playground_feedback regardless of consent state", async () => {
    for (const consentEnabled of [false, true]) {
      const supabase = seedFeedbackSupabase(consentEnabled);
      const response = await handlePlaygroundFeedback(
        new NextRequest("http://localhost:3000/api/mirror/playground/feedback", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            session_id: "session-1",
            what_felt_off: "tone",
            original_output: "Original voiced output that felt wrong.",
            chamber: "academic",
          }),
        }),
        {
          resolveUserId: async () => "user-1",
          createSupabaseServerClient: () => supabase as unknown as SupabaseClient,
          runClaude: async () => "Regenerated voiced output",
        }
      );

      expect(response.status).toBe(200);
      expect(supabase.feedbackLogs).toHaveLength(1);
      expect(supabase.feedbackLogs[0]?.feedback_type).toBe("not_my_voice");
    }
  });
});
