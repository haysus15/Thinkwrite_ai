import { expect, test } from "playwright/test";
import { NextRequest } from "next/server.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getVoiceReadinessState } from "@/lib/mirror-mode/playgroundVoiceState";
import { handleGeneratePlayground } from "@/app/api/mirror/playground/generate/handler";
import { handleCreatePlaygroundSession } from "@/app/api/mirror/playground/session/handler";

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
  conversation_onboarding: boolean;
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

class ZeroCapturesSupabase {
  sessions = new Map<string, SessionRecord>();
  voiceChambers = new Map<string, VoiceChamberRecord>();
  sequence = 1;
  failVoiceReadinessQuery = false;

  from(table: string) {
    if (table === "voice_chambers") {
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
              if (self.failVoiceReadinessQuery) {
                return { data: null, error: { message: "db offline" } };
              }
              const row =
                Array.from(self.voiceChambers.values()).find((record) =>
                  filters.every(
                    (filter) => String((record as Record<string, unknown>)[filter.column]) === filter.value
                  )
                ) || null;
              return { data: row, error: null };
            },
            then(
              resolve: (value: { data: VoiceChamberRecord[]; error: { message: string } | null }) => unknown,
              reject?: (reason?: unknown) => unknown
            ) {
              if (self.failVoiceReadinessQuery) {
                return Promise.resolve({ data: [], error: { message: "db offline" } }).then(resolve, reject);
              }
              const data = Array.from(self.voiceChambers.values()).filter((record) =>
                filters.every(
                  (filter) => String((record as Record<string, unknown>)[filter.column]) === filter.value
                )
              );
              return Promise.resolve({ data, error: null }).then(resolve, reject);
            },
          };
          return query;
        },
      };
    }

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
    }),
  });
}

test.describe("mirror playground zero captures", () => {
  test("getVoiceReadinessState returns hasAnyData: false when no voice_chambers rows exist", async () => {
    const supabase = new ZeroCapturesSupabase();
    const state = await getVoiceReadinessState("user-1", supabase as unknown as SupabaseClient);

    expect(state).toMatchObject({
      hasAnyData: false,
      chambersWithData: [],
      chambersEmpty: ["career", "academic", "creative", "general"],
      overallConfidence: 0,
    });
  });

  test("getVoiceReadinessState returns hasAnyData: false when all chambers have document_count = 0", async () => {
    const supabase = new ZeroCapturesSupabase();
    for (const chamber of ["career", "academic", "creative", "general", "overall"]) {
      supabase.voiceChambers.set(`user-1:${chamber}`, {
        user_id: "user-1",
        chamber,
        aggregate_fingerprint: {},
        confidence_level: 0,
        document_count: 0,
      });
    }

    const state = await getVoiceReadinessState("user-1", supabase as unknown as SupabaseClient);
    expect(state.hasAnyData).toBe(false);
    expect(state.chambersWithData).toEqual([]);
  });

  test("getVoiceReadinessState returns hasAnyData: true with correct chamber breakdown when data exists", async () => {
    const supabase = new ZeroCapturesSupabase();
    supabase.voiceChambers.set("user-1:career", {
      user_id: "user-1",
      chamber: "career",
      aggregate_fingerprint: {},
      confidence_level: 52,
      document_count: 3,
    });
    supabase.voiceChambers.set("user-1:general", {
      user_id: "user-1",
      chamber: "general",
      aggregate_fingerprint: {},
      confidence_level: 31,
      document_count: 1,
    });
    supabase.voiceChambers.set("user-1:overall", {
      user_id: "user-1",
      chamber: "overall",
      aggregate_fingerprint: {},
      confidence_level: 57,
      document_count: 4,
    });

    const state = await getVoiceReadinessState("user-1", supabase as unknown as SupabaseClient);
    expect(state).toMatchObject({
      hasAnyData: true,
      chambersWithData: ["career", "general"],
      chambersEmpty: ["academic", "creative"],
      overallConfidence: 57,
      lowestConfidenceChamber: "general",
    });
  });

  test("overall chamber excluded from classifiable chamber lists", async () => {
    const supabase = new ZeroCapturesSupabase();
    supabase.voiceChambers.set("user-1:overall", {
      user_id: "user-1",
      chamber: "overall",
      aggregate_fingerprint: {},
      confidence_level: 61,
      document_count: 3,
    });

    const state = await getVoiceReadinessState("user-1", supabase as unknown as SupabaseClient);
    expect(state.chambersWithData).not.toContain("overall");
    expect(state.chambersEmpty).not.toContain("overall");
  });

  test("Generate endpoint returns zero_captures_state: true and onboarding_paths when no data exists", async () => {
    const supabase = new ZeroCapturesSupabase();
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
      conversation_onboarding: false,
      confirmation_sent: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    let runClaudeCalls = 0;
    const response = await handleGeneratePlayground(buildGenerateRequest("session-1"), {
      resolveUserId: async () => "user-1",
      createSupabaseServerClient: () => supabase as unknown as SupabaseClient,
      runClaude: async () => {
        runClaudeCalls += 1;
        return "should not run";
      },
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(runClaudeCalls).toBe(0);
    expect(data.zero_captures_state).toBe(true);
    expect(data.voiced_output).toBeNull();
    expect(data.onboarding_paths.upload.route).toBe("/app/mirror/settings");
    expect(data.onboarding_paths.extension.route).toBe("/app/mirror/settings");
  });

  test("Generate endpoint uses overall fallback when requested chamber is empty but other data exists", async () => {
    const supabase = new ZeroCapturesSupabase();
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
      conversation_onboarding: false,
      confirmation_sent: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    supabase.voiceChambers.set("user-1:overall", {
      user_id: "user-1",
      chamber: "overall",
      aggregate_fingerprint: {
        rhythm: { avgSentenceLength: 18, sentenceVariation: 6, shortSentenceRatio: 0.15 },
        vocabulary: { complexWordRatio: 0.15, contractionRatio: 0.01, topWords: ["project", "evidence"] },
        voice: {
          formalityScore: 0.55,
          assertiveDensity: 0.01,
          hedgeDensity: 0.004,
          personalPronounRate: 0.03,
          activeVoiceRatio: 0.8,
        },
        punctuation: { exclamationRate: 0, questionRate: 0, dashRate: 0, semicolonRate: 0, ellipsisRate: 0 },
        rhetoric: { transitionWordRate: 0.1, questionOpenerRate: 0, listUsageRate: 0, exampleUsageRate: 0 },
      },
      confidence_level: 44,
      document_count: 3,
    });
    supabase.voiceChambers.set("user-1:general", {
      user_id: "user-1",
      chamber: "general",
      aggregate_fingerprint: {
        rhythm: { avgSentenceLength: 16, sentenceVariation: 5, shortSentenceRatio: 0.12 },
        vocabulary: { complexWordRatio: 0.12, contractionRatio: 0.02, topWords: ["project", "evidence"] },
        voice: {
          formalityScore: 0.5,
          assertiveDensity: 0.01,
          hedgeDensity: 0.005,
          personalPronounRate: 0.04,
          activeVoiceRatio: 0.8,
        },
        punctuation: { exclamationRate: 0, questionRate: 0, dashRate: 0, semicolonRate: 0, ellipsisRate: 0 },
        rhetoric: { transitionWordRate: 0.1, questionOpenerRate: 0, listUsageRate: 0, exampleUsageRate: 0 },
      },
      confidence_level: 38,
      document_count: 2,
    });

    const systems: string[] = [];
    const response = await handleGeneratePlayground(buildGenerateRequest("session-1", "academic"), {
      resolveUserId: async () => "user-1",
      createSupabaseServerClient: () => supabase as unknown as SupabaseClient,
      runClaude: async ({ system }) => {
        systems.push(system);
        return systems.length === 1 ? "generic draft" : "voiced draft";
      },
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.voiced_output).toBe("voiced draft");
    expect(data.confidence_context).toContain("do not have your academic voice yet");
    expect(systems[1]).toContain("project, evidence");
  });

  test("Session created with conversation_onboarding: true when flag passed", async () => {
    const supabase = new ZeroCapturesSupabase();
    const request = new NextRequest("http://localhost:3000/api/mirror/playground/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversation_onboarding: true }),
    });

    const response = await handleCreatePlaygroundSession(request, {
      resolveUserId: async () => "user-1",
      createSupabaseServerClient: () => supabase as unknown as SupabaseClient,
    });

    expect(response.status).toBe(200);
    expect(supabase.sessions.get("session-1")?.conversation_onboarding).toBe(true);
  });

  test("getVoiceReadinessState query error treated as hasAnyData: false, does not throw", async () => {
    const supabase = new ZeroCapturesSupabase();
    supabase.failVoiceReadinessQuery = true;

    await expect(
      getVoiceReadinessState("user-1", supabase as unknown as SupabaseClient)
    ).resolves.toMatchObject({
      hasAnyData: false,
      chambersWithData: [],
    });
  });
});
