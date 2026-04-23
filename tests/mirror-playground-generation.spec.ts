import { expect, test } from "playwright/test";
import { NextRequest } from "next/server.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { handleCreatePlaygroundSession } from "@/app/api/mirror/playground/session/handler";
import { handleGeneratePlayground } from "@/app/api/mirror/playground/generate/handler";
import { handleGetPlaygroundSession } from "@/app/api/mirror/playground/session/[id]/handler";

type SessionRecord = {
  id: string;
  user_id: string;
  messages: unknown[];
  context_memory: Record<string, unknown>;
  generation_request: Record<string, unknown> | null;
  generic_output: string | null;
  voiced_output: string | null;
  chamber: string | null;
  feedback_signals: unknown[];
  conversation_onboarding?: boolean;
  confirmation_sent?: boolean;
  created_at: string;
  updated_at: string;
};

type VoiceChamberRecord = {
  user_id: string;
  chamber: string;
  aggregate_fingerprint: Record<string, unknown>;
  confidence_level: number;
  document_count: number;
};

class PlaygroundSupabase {
  sessions = new Map<string, SessionRecord>();
  voiceChambers = new Map<string, VoiceChamberRecord>();
  sequence = 1;

  from(table: string) {
    if (table === "mirror_playground_sessions") {
      const self = this;
      let filters: Array<{ column: string; value: string }> = [];
      return {
        insert(payload: Record<string, unknown>) {
          return {
            select() {
              return {
                async single() {
                  const id = `session-${self.sequence++}`;
                  const row: SessionRecord = {
                    id,
                    user_id: String(payload.user_id),
                    messages: (payload.messages as unknown[]) || [],
                    context_memory: (payload.context_memory as Record<string, unknown>) || {},
                    generation_request: null,
                    generic_output: null,
                    voiced_output: null,
                    chamber: null,
                    feedback_signals: (payload.feedback_signals as unknown[]) || [],
                    conversation_onboarding: Boolean(payload.conversation_onboarding),
                    confirmation_sent: false,
                    created_at: String(payload.created_at),
                    updated_at: String(payload.updated_at),
                  };
                  self.sessions.set(id, row);
                  return { data: { id }, error: null };
                },
              };
            },
          };
        },
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
            async then(
              resolve: (value: { data: VoiceChamberRecord[]; error: null }) => unknown,
              reject?: (reason?: unknown) => unknown
            ) {
              const rows = Array.from(self.voiceChambers.values()).filter((row) =>
                userId ? row.user_id === userId : true
              );
              return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
            },
            async maybeSingle() {
              return { data: self.voiceChambers.get(`${userId}:${chamber}`) || null, error: null };
            },
          };
          return query;
        },
      };
    }

    throw new Error(`Unexpected table ${table}`);
  }
}

function buildGenerateRequest(sessionId: string, chamber = "academic") {
  return new NextRequest("http://localhost:3000/api/mirror/playground/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      session_id: sessionId,
      chamber,
      audience: "Professor Allen",
      purpose: "Explain why the argument needs one more revision",
      tone: "direct but respectful",
      content: "I need to explain that the evidence section is still weak and I need another day.",
      enrichment: { relationship: "thesis advisor" },
    }),
  });
}

test.describe("mirror playground generation", () => {
  test("session record created correctly on POST to session endpoint", async () => {
    const supabase = new PlaygroundSupabase();
    const response = await handleCreatePlaygroundSession(
      new NextRequest("http://localhost:3000/api/mirror/playground/session", { method: "POST" }),
      {
        resolveUserId: async () => "user-1",
        createSupabaseServerClient: () => supabase as unknown as SupabaseClient,
      }
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.session_id).toBe("session-1");
    expect(supabase.sessions.get("session-1")).toMatchObject({
      user_id: "user-1",
      messages: [],
      context_memory: {},
      feedback_signals: [],
    });
  });

  test("generic output generated without voice fingerprint applied", async () => {
    const supabase = new PlaygroundSupabase();
    supabase.sessions.set("session-1", {
      id: "session-1",
      user_id: "user-1",
      messages: [],
      context_memory: {},
      generation_request: null,
      generic_output: null,
      voiced_output: null,
      chamber: null,
      feedback_signals: [],
      confirmation_sent: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    supabase.voiceChambers.set("user-1:academic", {
      user_id: "user-1",
      chamber: "academic",
      aggregate_fingerprint: {
        rhythm: { avgSentenceLength: 14, sentenceVariation: 4, shortSentenceRatio: 0.1 },
        vocabulary: { complexWordRatio: 0.1, contractionRatio: 0.02, topWords: ["argument"] },
        voice: {
          formalityScore: 0.6,
          assertiveDensity: 0.01,
          hedgeDensity: 0.004,
          personalPronounRate: 0.03,
          activeVoiceRatio: 0.8,
        },
        punctuation: { exclamationRate: 0, questionRate: 0, dashRate: 0, semicolonRate: 0, ellipsisRate: 0 },
        rhetoric: { transitionWordRate: 0.1, questionOpenerRate: 0, listUsageRate: 0, exampleUsageRate: 0 },
      } as Record<string, unknown>,
      confidence_level: 62,
      document_count: 4,
    });

    const calls: Array<{ system: string; prompt: string }> = [];
    const response = await handleGeneratePlayground(buildGenerateRequest("session-1"), {
      resolveUserId: async () => "user-1",
      createSupabaseServerClient: () => supabase as unknown as SupabaseClient,
      runClaude: async ({ system }) => {
        calls.push({ system, prompt: "" });
        return calls.length === 1 ? "generic draft" : "voiced draft";
      },
    });

    expect(response.status).toBe(200);
    expect(calls[0]?.system).toContain("Write clear, competent, professional prose.");
    expect(calls[0]?.system).not.toContain("THE USER'S WRITING VOICE");
  });

  test("voiced output uses correct chamber fingerprint", async () => {
    const supabase = new PlaygroundSupabase();
    supabase.sessions.set("session-1", {
      id: "session-1",
      user_id: "user-1",
      messages: [],
      context_memory: {},
      generation_request: null,
      generic_output: null,
      voiced_output: null,
      chamber: null,
      feedback_signals: [],
      confirmation_sent: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    supabase.voiceChambers.set("user-1:career", {
      user_id: "user-1",
      chamber: "career",
      aggregate_fingerprint: {
        rhythm: { avgSentenceLength: 23, sentenceVariation: 9, shortSentenceRatio: 0.3 },
        vocabulary: { complexWordRatio: 0.2, contractionRatio: 0.03, topWords: ["urgency", "scope"] },
        voice: {
          formalityScore: 0.72,
          assertiveDensity: 0.02,
          hedgeDensity: 0.001,
          personalPronounRate: 0.02,
          activeVoiceRatio: 0.9,
        },
        punctuation: { exclamationRate: 0, questionRate: 0, dashRate: 6, semicolonRate: 0, ellipsisRate: 0 },
        rhetoric: { transitionWordRate: 0.2, questionOpenerRate: 0, listUsageRate: 0, exampleUsageRate: 0 },
      } as Record<string, unknown>,
      confidence_level: 71,
      document_count: 5,
    });

    const systems: string[] = [];
    const response = await handleGeneratePlayground(buildGenerateRequest("session-1", "career"), {
      resolveUserId: async () => "user-1",
      createSupabaseServerClient: () => supabase as unknown as SupabaseClient,
      runClaude: async ({ system }) => {
        systems.push(system);
        return systems.length === 1 ? "generic" : "voiced";
      },
    });

    expect(response.status).toBe(200);
    expect(systems[1]).toContain("THE USER'S WRITING VOICE");
    expect(systems[1]).toContain("urgency, scope");
    expect(systems[1]).toContain("Very formal, professional tone");
  });

  test("low confidence chamber returns confidence_context string, not empty output", async () => {
    const supabase = new PlaygroundSupabase();
    supabase.sessions.set("session-1", {
      id: "session-1",
      user_id: "user-1",
      messages: [],
      context_memory: {},
      generation_request: null,
      generic_output: null,
      voiced_output: null,
      chamber: null,
      feedback_signals: [],
      confirmation_sent: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    supabase.voiceChambers.set("user-1:general", {
      user_id: "user-1",
      chamber: "general",
      aggregate_fingerprint: {
        rhythm: { avgSentenceLength: 12, sentenceVariation: 4, shortSentenceRatio: 0.2 },
        vocabulary: { complexWordRatio: 0.1, contractionRatio: 0.02, topWords: ["project"] },
        voice: {
          formalityScore: 0.4,
          assertiveDensity: 0.01,
          hedgeDensity: 0.01,
          personalPronounRate: 0.05,
          activeVoiceRatio: 0.7,
        },
        punctuation: { exclamationRate: 0, questionRate: 0, dashRate: 0, semicolonRate: 0, ellipsisRate: 0 },
        rhetoric: { transitionWordRate: 0.1, questionOpenerRate: 0, listUsageRate: 0, exampleUsageRate: 0 },
      } as Record<string, unknown>,
      confidence_level: 12,
      document_count: 1,
    });

    const response = await handleGeneratePlayground(buildGenerateRequest("session-1", "general"), {
      resolveUserId: async () => "user-1",
      createSupabaseServerClient: () => supabase as unknown as SupabaseClient,
      runClaude: async ({ system }) =>
        system.includes("THE USER'S WRITING VOICE") ? "voiced output" : "generic output",
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.voiced_output).toBe("voiced output");
    expect(data.confidence_context).toContain("still taking shape");
  });

  test("session record updated after generation with correct fields", async () => {
    const supabase = new PlaygroundSupabase();
    supabase.sessions.set("session-1", {
      id: "session-1",
      user_id: "user-1",
      messages: [],
      context_memory: {},
      generation_request: null,
      generic_output: null,
      voiced_output: null,
      chamber: null,
      feedback_signals: [],
      confirmation_sent: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    supabase.voiceChambers.set("user-1:academic", {
      user_id: "user-1",
      chamber: "academic",
      aggregate_fingerprint: {
        rhythm: { avgSentenceLength: 14, sentenceVariation: 4, shortSentenceRatio: 0.1 },
        vocabulary: { complexWordRatio: 0.1, contractionRatio: 0.02, topWords: ["argument"] },
        voice: {
          formalityScore: 0.6,
          assertiveDensity: 0.01,
          hedgeDensity: 0.004,
          personalPronounRate: 0.03,
          activeVoiceRatio: 0.8,
        },
        punctuation: { exclamationRate: 0, questionRate: 0, dashRate: 0, semicolonRate: 0, ellipsisRate: 0 },
        rhetoric: { transitionWordRate: 0.1, questionOpenerRate: 0, listUsageRate: 0, exampleUsageRate: 0 },
      } as Record<string, unknown>,
      confidence_level: 62,
      document_count: 4,
    });

    await handleGeneratePlayground(buildGenerateRequest("session-1"), {
      resolveUserId: async () => "user-1",
      createSupabaseServerClient: () => supabase as unknown as SupabaseClient,
      runClaude: async ({ system }) =>
        system.includes("THE USER'S WRITING VOICE") ? "voiced draft" : "generic draft",
    });

    expect(supabase.sessions.get("session-1")).toMatchObject({
      chamber: "academic",
      generic_output: "generic draft",
      voiced_output: "voiced draft",
    });
    expect(supabase.sessions.get("session-1")?.generation_request).toMatchObject({
      audience: "Professor Allen",
      purpose: "Explain why the argument needs one more revision",
      tone: "direct but respectful",
      confidence_level: 62,
    });
  });

  test("GET session returns correct session for authenticated user", async () => {
    const supabase = new PlaygroundSupabase();
    supabase.sessions.set("session-1", {
      id: "session-1",
      user_id: "user-1",
      messages: [{ role: "user", message: "hello" }],
      context_memory: { professor: "Allen" },
      generation_request: { tone: "direct" },
      generic_output: "generic",
      voiced_output: "voiced",
      chamber: "academic",
      feedback_signals: [],
      confirmation_sent: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const response = await handleGetPlaygroundSession(
      new NextRequest("http://localhost:3000/api/mirror/playground/session/session-1"),
      { id: "session-1" },
      {
        resolveUserId: async () => "user-1",
        createSupabaseServerClient: () => supabase as unknown as SupabaseClient,
      }
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.session).toMatchObject({
      id: "session-1",
      user_id: "user-1",
      generic_output: "generic",
      voiced_output: "voiced",
      chamber: "academic",
    });
  });

  test("GET session returns 404 for session belonging to different user", async () => {
    const supabase = new PlaygroundSupabase();
    supabase.sessions.set("session-1", {
      id: "session-1",
      user_id: "user-2",
      messages: [],
      context_memory: {},
      generation_request: null,
      generic_output: null,
      voiced_output: null,
      chamber: null,
      feedback_signals: [],
      confirmation_sent: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const response = await handleGetPlaygroundSession(
      new NextRequest("http://localhost:3000/api/mirror/playground/session/session-1"),
      { id: "session-1" },
      {
        resolveUserId: async () => "user-1",
        createSupabaseServerClient: () => supabase as unknown as SupabaseClient,
      }
    );

    expect(response.status).toBe(404);
  });
});
