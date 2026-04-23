import { expect, test } from "playwright/test";
import { NextRequest } from "next/server.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { VoiceFingerprint } from "@/lib/mirror-core/voiceAnalysis";
import {
  blendVoiceFingerprints,
  buildSubcategoryVoiceGenerationContext,
  buildVoiceSystemPrompt,
  type VoiceToneOverride,
} from "@/lib/mirror-core/voiceGeneration";
import { handleGeneratePlayground } from "@/app/api/mirror/playground/generate/handler";

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
  confirmation_sent?: boolean;
  created_at: string;
  updated_at: string;
};

type SubcategoryRecord = {
  id: string;
  user_id: string;
  name: string;
  parent_chamber: string;
  aggregate_fingerprint: VoiceFingerprint;
  confidence_level: number;
  document_count: number;
  total_word_count: number;
  last_trained_at: string | null;
  evolution_history: unknown[];
  created_at: string;
  updated_at: string;
};

function createFingerprint(overrides?: Partial<VoiceFingerprint>): VoiceFingerprint {
  return {
    vocabulary: {
      uniqueWordCount: 100,
      avgWordLength: 5,
      complexWordRatio: 0.1,
      contractionRatio: 0.02,
      topWords: ["deadline", "scope"],
      rarityScore: 0.3,
      ...overrides?.vocabulary,
    },
    rhythm: {
      avgSentenceLength: 15,
      sentenceVariation: 4,
      shortSentenceRatio: 0.2,
      longSentenceRatio: 0.1,
      avgParagraphLength: 90,
      paragraphVariation: 8,
      ...overrides?.rhythm,
    },
    punctuation: {
      exclamationRate: 0,
      questionRate: 1,
      semicolonRate: 0,
      dashRate: 2,
      ellipsisRate: 0,
      colonRate: 0,
      commaRate: 12,
      ...overrides?.punctuation,
    },
    voice: {
      hedgeDensity: 0.01,
      qualifierDensity: 0.02,
      assertiveDensity: 0.01,
      personalPronounRate: 0.03,
      formalityScore: 0.55,
      activeVoiceRatio: 0.8,
      ...overrides?.voice,
    },
    rhetoric: {
      questionOpenerRate: 0,
      transitionWordRate: 0.1,
      listUsageRate: 0,
      exampleUsageRate: 0.05,
      emphasisPatterns: ["dash-emphasis"],
      ...overrides?.rhetoric,
    },
    meta: {
      sampleWordCount: 1200,
      sampleSentenceCount: 80,
      extractedAt: "2026-03-25T00:00:00.000Z",
      version: "test-1",
      ...overrides?.meta,
    },
  };
}

class VoiceGenerationSupabase {
  sessions = new Map<string, SessionRecord>();
  voiceChambers = new Map<string, { user_id: string; chamber: string; aggregate_fingerprint: VoiceFingerprint; confidence_level: number; document_count: number }>();
  subcategories = new Map<string, SubcategoryRecord>();
  contextMemory = new Map<string, Array<Record<string, unknown>>>();
  failSubcategoryLookup = false;

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
            async then(
              resolve: (value: { data: Array<Record<string, unknown>>; error: null }) => unknown,
              reject?: (reason?: unknown) => unknown
            ) {
              const rows = Array.from(self.voiceChambers.values()).filter((row) =>
                userId ? row.user_id === userId : true
              );
              return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
            },
          };
          return query;
        },
      };
    }

    if (table === "mirror_subcategories") {
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
              if (self.failSubcategoryLookup) {
                return { data: null, error: { message: "subcategory offline" } };
              }
              const row =
                Array.from(self.subcategories.values()).find((subcategory) =>
                  filters.every(
                    (filter) =>
                      String((subcategory as Record<string, unknown>)[filter.column]) === filter.value
                  )
                ) || null;
              return { data: row, error: null };
            },
          };
          return query;
        },
      };
    }

    if (table === "mirror_context_memory") {
      const self = this;
      let userId = "";
      let subcategoryId = "";
      return {
        select() {
          const query = {
            eq(column: string, value: string) {
              if (column === "user_id") userId = value;
              if (column === "subcategory_id") subcategoryId = value;
              return query;
            },
            order() {
              const rows = (self.contextMemory.get(`${userId}:${subcategoryId}`) || []) as Array<Record<string, unknown>>;
              return Promise.resolve({ data: rows, error: null });
            },
          };
          return query;
        },
      };
    }

    throw new Error(`Unexpected table ${table}`);
  }
}

function seedSubcategoryContext(
  supabase: VoiceGenerationSupabase,
  documentCount: number,
  subcategoryId = "sub-1"
) {
  supabase.voiceChambers.set("user-1:career", {
    user_id: "user-1",
    chamber: "career",
    aggregate_fingerprint: createFingerprint({
      vocabulary: { avgWordLength: 5, topWords: ["deadline", "scope"], complexWordRatio: 0.1, contractionRatio: 0.02, uniqueWordCount: 100, rarityScore: 0.3 },
      rhythm: { avgSentenceLength: 10, sentenceVariation: 4, shortSentenceRatio: 0.2, longSentenceRatio: 0.1, avgParagraphLength: 80, paragraphVariation: 6 },
      voice: { formalityScore: 0.3, hedgeDensity: 0.01, qualifierDensity: 0.02, assertiveDensity: 0.01, personalPronounRate: 0.03, activeVoiceRatio: 0.8 },
    }),
    confidence_level: 65,
    document_count: 12,
  });
  supabase.subcategories.set(subcategoryId, {
    id: subcategoryId,
    user_id: "user-1",
    name: "Manager Emails",
    parent_chamber: "career",
    aggregate_fingerprint: createFingerprint({
      vocabulary: { avgWordLength: 10, topWords: ["stakeholder", "alignment"], complexWordRatio: 0.25, contractionRatio: 0.01, uniqueWordCount: 160, rarityScore: 0.6 },
      rhythm: { avgSentenceLength: 20, sentenceVariation: 8, shortSentenceRatio: 0.05, longSentenceRatio: 0.3, avgParagraphLength: 130, paragraphVariation: 12 },
      voice: { formalityScore: 0.8, hedgeDensity: 0.003, qualifierDensity: 0.01, assertiveDensity: 0.03, personalPronounRate: 0.02, activeVoiceRatio: 0.9 },
    }),
    confidence_level: 40,
    document_count: documentCount,
    total_word_count: 2200,
    last_trained_at: new Date().toISOString(),
    evolution_history: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

function buildGenerateRequest(sessionId: string, chamber = "career") {
  return new NextRequest("http://localhost:3000/api/mirror/playground/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      session_id: sessionId,
      chamber,
      audience: "Sarah",
      purpose: "Ask for timeline approval",
      tone: "direct but respectful",
      content: "I need to explain why the team needs another review pass.",
      enrichment: { relationship: "manager" },
    }),
  });
}

test.describe("mirror subcategory generation", () => {
  test("generation with subcategoryId uses blended fingerprint at developing threshold (parent only)", async () => {
    const supabase = new VoiceGenerationSupabase();
    seedSubcategoryContext(supabase, 2);

    const context = await buildSubcategoryVoiceGenerationContext({
      userId: "user-1",
      chamber: "career",
      subcategoryId: "sub-1",
      toneOverride: "match",
      supabase: supabase as unknown as SupabaseClient,
    });

    expect(context?.threshold).toBe("developing");
    expect(context?.blendedFingerprint.vocabulary.avgWordLength).toBe(5);
    expect(context?.blendedFingerprint.rhythm.avgSentenceLength).toBe(10);
  });

  test("generation with subcategoryId uses blended fingerprint at emerging threshold (60/40)", async () => {
    const supabase = new VoiceGenerationSupabase();
    seedSubcategoryContext(supabase, 3);

    const context = await buildSubcategoryVoiceGenerationContext({
      userId: "user-1",
      chamber: "career",
      subcategoryId: "sub-1",
      toneOverride: "match",
      supabase: supabase as unknown as SupabaseClient,
    });

    expect(context?.threshold).toBe("emerging");
    expect(context?.blendedFingerprint.vocabulary.avgWordLength).toBe(7);
    expect(context?.blendedFingerprint.rhythm.avgSentenceLength).toBe(14);
  });

  test("generation with subcategoryId uses blended fingerprint at established threshold (20/80)", async () => {
    const supabase = new VoiceGenerationSupabase();
    seedSubcategoryContext(supabase, 10);

    const context = await buildSubcategoryVoiceGenerationContext({
      userId: "user-1",
      chamber: "career",
      subcategoryId: "sub-1",
      toneOverride: "match",
      supabase: supabase as unknown as SupabaseClient,
    });

    expect(context?.threshold).toBe("established");
    expect(context?.blendedFingerprint.vocabulary.avgWordLength).toBe(9);
    expect(context?.blendedFingerprint.rhythm.avgSentenceLength).toBe(18);
  });

  test("developing threshold includes confidence_context in response", async () => {
    const supabase = new VoiceGenerationSupabase();
    seedSubcategoryContext(supabase, 1);

    const context = await buildSubcategoryVoiceGenerationContext({
      userId: "user-1",
      chamber: "career",
      subcategoryId: "sub-1",
      toneOverride: "match" as VoiceToneOverride,
      supabase: supabase as unknown as SupabaseClient,
    });

    expect(context?.confidenceContext).toContain("leaning on your career foundation");
  });

  test("emerging and established thresholds do not include confidence_context", async () => {
    const emergingSupabase = new VoiceGenerationSupabase();
    seedSubcategoryContext(emergingSupabase, 4, "sub-1");
    const establishedSupabase = new VoiceGenerationSupabase();
    seedSubcategoryContext(establishedSupabase, 12, "sub-2");

    const emerging = await buildSubcategoryVoiceGenerationContext({
      userId: "user-1",
      chamber: "career",
      subcategoryId: "sub-1",
      toneOverride: "match",
      supabase: emergingSupabase as unknown as SupabaseClient,
    });
    const established = await buildSubcategoryVoiceGenerationContext({
      userId: "user-1",
      chamber: "career",
      subcategoryId: "sub-2",
      toneOverride: "match",
      supabase: establishedSupabase as unknown as SupabaseClient,
    });

    expect(emerging?.confidenceContext).toBeNull();
    expect(established?.confidenceContext).toBeNull();
  });

  test("Context Memory entries are injected into generation prompt as natural language facts", async () => {
    const supabase = new VoiceGenerationSupabase();
    seedSubcategoryContext(supabase, 10);
    supabase.contextMemory.set("user-1:sub-1", [
      {
        id: "ctx-1",
        user_id: "user-1",
        subcategory_id: "sub-1",
        entity_type: "person",
        entity_name: "Sarah",
        attributes: {
          role: "Engineering Manager",
          company: "TechCorp",
          pronouns: "she/her",
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);

    const context = await buildSubcategoryVoiceGenerationContext({
      userId: "user-1",
      chamber: "career",
      subcategoryId: "sub-1",
      toneOverride: "match",
      supabase: supabase as unknown as SupabaseClient,
    });

    expect(context?.systemPrompt).toContain("Known context for this writing: [Sarah is Engineering Manager at TechCorp, she/her]");
  });

  test("subcategory fingerprint retrieval failure falls back to chamber-only generation", async () => {
    const supabase = new VoiceGenerationSupabase();
    supabase.sessions.set("session-1", {
      id: "session-1",
      user_id: "user-1",
      messages: [],
      context_memory: {},
      generation_request: { subcategory_id: "sub-1" },
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
      aggregate_fingerprint: createFingerprint(),
      confidence_level: 62,
      document_count: 4,
    });
    supabase.failSubcategoryLookup = true;

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
    expect(systems[1]).not.toContain("Known context for this writing:");
  });

  test("chamber-only generation (no subcategoryId) is completely unchanged", async () => {
    const parent = createFingerprint();
    const originalPrompt = buildVoiceSystemPrompt(parent, "match");

    const supabase = new VoiceGenerationSupabase();
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
      aggregate_fingerprint: parent,
      confidence_level: 62,
      document_count: 4,
    });

    const systems: string[] = [];
    await handleGeneratePlayground(buildGenerateRequest("session-1", "career"), {
      resolveUserId: async () => "user-1",
      createSupabaseServerClient: () => supabase as unknown as SupabaseClient,
      runClaude: async ({ system }) => {
        systems.push(system);
        return systems.length === 1 ? "generic" : "voiced";
      },
    });

    expect(systems[1]).toBe(originalPrompt);
  });

  test("blendVoiceFingerprints respects weights directly", async () => {
    const blended = blendVoiceFingerprints(
      createFingerprint({
        vocabulary: { avgWordLength: 4, topWords: ["one"], complexWordRatio: 0.1, contractionRatio: 0.02, uniqueWordCount: 100, rarityScore: 0.3 },
      }),
      createFingerprint({
        vocabulary: { avgWordLength: 8, topWords: ["two"], complexWordRatio: 0.2, contractionRatio: 0.01, uniqueWordCount: 200, rarityScore: 0.7 },
      }),
      { parentWeight: 0.6, subcategoryWeight: 0.4, threshold: "emerging" }
    );

    expect(blended.vocabulary.avgWordLength).toBe(5.6);
    expect(blended.vocabulary.topWords).toEqual(["one", "two"]);
  });
});
