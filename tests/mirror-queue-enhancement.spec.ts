import { expect, test } from "playwright/test";
import { NextRequest } from "next/server.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { handleExtensionFingerprintPost } from "@/app/api/mirror-mode/extension/fingerprint/handler";
import { handleUpdatePlaygroundSession } from "@/app/api/mirror/playground/session/[id]/handler";
import { handleClassifyUnclassified } from "@/app/api/mirror/unclassified/handler";
import type { ExtensionFingerprint } from "@/lib/mirror-core/extension/ingestion";
import type { ContextObservations } from "@/lib/mirror-core/contextMemoryService";

function createFingerprint(chamber: ExtensionFingerprint["chamber"] = "general"): ExtensionFingerprint {
  return {
    sessionId: "session-1",
    chamber,
    sourceType: "extension",
    capturedAt: "2026-03-25T12:00:00.000Z",
    wordCount: 120,
    avgSentenceLength: 12,
    sentenceLengthVariance: 2,
    avgParagraphLength: 40,
    shortSentenceRate: 0.2,
    longSentenceRate: 0.1,
    lexicalDensity: 0.5,
    avgWordLength: 4.5,
    contractionRate: 0.1,
    passiveVoiceRate: 0.05,
    hedgeWordRate: 0.02,
    questionRate: 0,
    exclamationRate: 0,
    emDashRate: 0,
    parentheticalRate: 0,
    connectorPreferences: {
      additive: 1,
      contrastive: 0,
      causal: 0,
      temporal: 0,
    },
    openingPatterns: {
      subjectFirst: 1,
      clauseFirst: 0,
      conjunctionFirst: 0,
      adverbFirst: 0,
    },
  };
}

function recommendationObservations(): ContextObservations {
  return {
    people: [{ name: "Sarah", role: "Manager", company: "TechCorp" }],
    writing_type: "professional email",
    relationship_direction: "upward",
    tone_observed: "formal but direct",
    recommended_chamber: "career",
    recommended_subcategory: "Manager Emails",
    recommendation_confidence: "high",
    recommendation_reasoning: "manager relationship and professional register",
  };
}

class ExtensionQueueSupabase {
  queueRows: Array<Record<string, unknown>> = [];

  from(table: string) {
    if (table === "mirror_domain_rules") {
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        async maybeSingle() {
          return { data: null };
        },
      };
    }

    if (table === "mirror_mode_consent") {
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        async maybeSingle() {
          return { data: { id: "consent-1" } };
        },
      };
    }

    if (table === "mirror_unclassified_queue") {
      const self = this;
      let filters: Array<{ column: string; value: string }> = [];
      return {
        insert(payload: Record<string, unknown>) {
          self.queueRows.push({
            id: "queue-1",
            reviewed: false,
            ...payload,
          });
          return Promise.resolve({ error: null });
        },
        select() {
          const query = {
            eq(column: string, value: string) {
              filters.push({ column, value });
              return query;
            },
            async maybeSingle() {
              const row =
                self.queueRows.find((candidate) =>
                  filters.every(
                    (filter) => String((candidate as Record<string, unknown>)[filter.column]) === filter.value
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
                  for (const row of self.queueRows) {
                    if (
                      filters.every(
                        (filter) => String((row as Record<string, unknown>)[filter.column]) === filter.value
                      )
                    ) {
                      Object.assign(row, values);
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
  pending_queue_acknowledgment: boolean;
  acknowledgment_redirect_count: number;
  updated_at: string;
};

class PlaygroundEnhancementSupabase {
  sessions = new Map<string, SessionRecord>();
  queueRows: Array<Record<string, unknown>> = [];

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

    if (table === "mirror_unclassified_queue") {
      const self = this;
      return {
        insert(payload: Record<string, unknown>) {
          const row = { id: `queue-${self.queueRows.length + 1}`, reviewed: false, ...payload };
          self.queueRows.push(row);
          return {
            select() {
              return {
                async single() {
                  return { data: { id: row.id }, error: null };
                },
              };
            },
          };
        },
      };
    }

    throw new Error(`Unexpected table ${table}`);
  }
}

type QueueRow = {
  id: string;
  user_id: string;
  source_domain: string;
  capture_source: string;
  fingerprint_data: Record<string, unknown>;
  word_count: number;
  captured_at: string;
  reviewed: boolean;
  assigned_chamber: string | null;
  assigned_at: string | null;
  context_observations: Record<string, unknown>;
  ursie_recommendation: Record<string, unknown> | null;
  subcategory_id: string | null;
  subcategory_confirmed: boolean;
};

class ClassificationSupabase {
  queueRows = new Map<string, QueueRow>();
  mirrorDocuments = new Map<string, Record<string, unknown>>();
  domainRules: Array<Record<string, unknown>> = [];

  from(table: string) {
    if (table === "mirror_unclassified_queue") {
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
                Array.from(self.queueRows.values()).find((candidate) =>
                  filters.every(
                    (filter) => String((candidate as Record<string, unknown>)[filter.column]) === filter.value
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
                  for (const row of self.queueRows.values()) {
                    if (
                      filters.every(
                        (filter) => String((row as Record<string, unknown>)[filter.column]) === filter.value
                      )
                    ) {
                      Object.assign(row, values);
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

    if (table === "mirror_documents") {
      const self = this;
      let filters: Array<{ column: string; value: string }> = [];
      return {
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
                  for (const [id, row] of self.mirrorDocuments.entries()) {
                    if (
                      filters.every(
                        (filter) => String((row as Record<string, unknown>)[filter.column]) === filter.value
                      )
                    ) {
                      self.mirrorDocuments.set(id, { ...row, ...values });
                    }
                  }
                  return Promise.resolve({ error: null }).then(resolve, reject);
                },
              };
              return query;
            },
          };
        },
        insert(payload: Record<string, unknown>) {
          const id = String(payload.id || `doc-${self.mirrorDocuments.size + 1}`);
          self.mirrorDocuments.set(id, { id, ...payload });
          return {
            select() {
              return {
                async single() {
                  return { data: { id }, error: null };
                },
              };
            },
          };
        },
      };
    }

    if (table === "mirror_domain_rules") {
      const self = this;
      return {
        upsert(payload: Record<string, unknown>) {
          self.domainRules.push(payload);
          return Promise.resolve({ error: null });
        },
      };
    }

    throw new Error(`Unexpected table ${table}`);
  }
}

function buildExtensionRequest() {
  return new NextRequest("http://localhost:3000/api/mirror-mode/extension/fingerprint", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-extension-hostname": "docs.google.com",
    },
    body: JSON.stringify(createFingerprint()),
  });
}

function buildPlaygroundPatch(messages: SessionMessage[]) {
  return new NextRequest("http://localhost:3000/api/mirror/playground/session/session-1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages }),
  });
}

function buildClassifyRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost:3000/api/mirror/unclassified/queue-1/classify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test.describe("mirror queue enhancement", () => {
  test("extension capture populates context_observations and ursie_recommendation after save", async () => {
    const supabase = new ExtensionQueueSupabase();
    let backgroundTask: Promise<void> | null = null;

    const response = await handleExtensionFingerprintPost(buildExtensionRequest(), {
      resolveUserId: async () => "user-1",
      createSupabaseAdmin: () => supabase as unknown as SupabaseClient,
      ingestExtensionFingerprint: async ({ fingerprint }) => ({
        captured: true,
        chamber: fingerprint.chamber,
        confidenceLevel: 0.5,
        confidenceLabel: "steady",
      }),
      extractContextObservations: async () => recommendationObservations(),
      generateUrsieRecommendationMessage: async () => "Generated Ursie note",
      scheduleBackgroundTask: (task) => {
        backgroundTask = task;
      },
    });

    expect(response.status).toBe(200);
    await backgroundTask;
    expect(supabase.queueRows[0]?.context_observations).toMatchObject({
      writing_type: "professional email",
    });
    expect(supabase.queueRows[0]?.ursie_recommendation).toMatchObject({
      chamber: "career",
      subcategory_name: "Manager Emails",
      confidence: "high",
    });
  });

  test("failed observation extraction does not fail the capture", async () => {
    const supabase = new ExtensionQueueSupabase();
    let backgroundTask: Promise<void> | null = null;

    const response = await handleExtensionFingerprintPost(buildExtensionRequest(), {
      resolveUserId: async () => "user-1",
      createSupabaseAdmin: () => supabase as unknown as SupabaseClient,
      ingestExtensionFingerprint: async ({ fingerprint }) => ({
        captured: true,
        chamber: fingerprint.chamber,
        confidenceLevel: 0.5,
        confidenceLabel: "steady",
      }),
      extractContextObservations: async () => {
        throw new Error("extract failed");
      },
      generateUrsieRecommendationMessage: async () => "Generated Ursie note",
      scheduleBackgroundTask: (task) => {
        backgroundTask = task;
      },
    });

    expect(response.status).toBe(200);
    await backgroundTask;
    expect(supabase.queueRows[0]?.context_observations).toBeUndefined();
  });

  test("playground ingestion with meaningful context sets pending_queue_acknowledgment and returns ursie_notification", async () => {
    const supabase = new PlaygroundEnhancementSupabase();
    supabase.sessions.set("session-1", {
      id: "session-1",
      user_id: "user-1",
      messages: [],
      context_memory: {},
      chamber: null,
      conversation_onboarding: true,
      pending_queue_acknowledgment: false,
      acknowledgment_redirect_count: 2,
      updated_at: new Date().toISOString(),
    });

    const response = await handleUpdatePlaygroundSession(
      buildPlaygroundPatch([
        {
          id: "msg-1",
          role: "user",
          text: "I need to explain the scope change to Sarah at TechCorp, because she reads urgency as if it cancels the extra review work my team already absorbed this week.",
        },
      ]),
      { id: "session-1" },
      {
        resolveUserId: async () => "user-1",
        createSupabaseServerClient: () => supabase as unknown as SupabaseClient,
        shouldIngest: () => true,
        ingestConversationMessage: async () => ({
          captured: true,
          archived: true,
          needsConsent: false,
          mirrorDocumentId: "doc-1",
          wordCount: 27,
        }),
        extractContextObservations: async () => recommendationObservations(),
        generateUrsieRecommendationMessage: async () => "I caught the shape of that note to Sarah. Look at the queue when you have a second.",
      }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      ursie_notification: "I caught the shape of that note to Sarah. Look at the queue when you have a second.",
    });
    expect(supabase.sessions.get("session-1")?.pending_queue_acknowledgment).toBe(true);
    expect(supabase.sessions.get("session-1")?.acknowledgment_redirect_count).toBe(0);
  });

  test("playground ingestion with no meaningful context does not set pending state", async () => {
    const supabase = new PlaygroundEnhancementSupabase();
    supabase.sessions.set("session-1", {
      id: "session-1",
      user_id: "user-1",
      messages: [],
      context_memory: {},
      chamber: null,
      conversation_onboarding: false,
      pending_queue_acknowledgment: false,
      acknowledgment_redirect_count: 0,
      updated_at: new Date().toISOString(),
    });

    const response = await handleUpdatePlaygroundSession(
      buildPlaygroundPatch([
        {
          id: "msg-1",
          role: "user",
          text: "I need to revise this paragraph because the evidence section still drifts and the opening sentence does not hold the argument together the way it should.",
        },
      ]),
      { id: "session-1" },
      {
        resolveUserId: async () => "user-1",
        createSupabaseServerClient: () => supabase as unknown as SupabaseClient,
        shouldIngest: () => true,
        ingestConversationMessage: async () => ({
          captured: true,
          archived: true,
          needsConsent: false,
          mirrorDocumentId: "doc-1",
          wordCount: 29,
        }),
        extractContextObservations: async () => ({
          ...recommendationObservations(),
          people: [],
          writing_type: "",
        }),
        generateUrsieRecommendationMessage: async () => "unused",
      }
    );

    expect(response.status).toBe(200);
    expect(supabase.sessions.get("session-1")?.pending_queue_acknowledgment).toBe(false);
    expect(supabase.queueRows).toHaveLength(0);
  });

  test("queue classification with subcategory_id links mirror_documents.subcategory_id correctly", async () => {
    const supabase = new ClassificationSupabase();
    supabase.queueRows.set("queue-1", {
      id: "queue-1",
      user_id: "user-1",
      source_domain: "docs.google.com",
      capture_source: "playground",
      fingerprint_data: {
        ...createFingerprint("general"),
        mirror_document_id: "doc-1",
      },
      word_count: 120,
      captured_at: new Date().toISOString(),
      reviewed: false,
      assigned_chamber: null,
      assigned_at: null,
      context_observations: recommendationObservations() as unknown as Record<string, unknown>,
      ursie_recommendation: null,
      subcategory_id: null,
      subcategory_confirmed: false,
    });
    supabase.mirrorDocuments.set("doc-1", { id: "doc-1", user_id: "user-1" });
    let saveCalled = false;

    const response = await handleClassifyUnclassified(
      buildClassifyRequest({ chamber: "career", create_domain_rule: false, subcategory_id: "sub-1" }),
      { id: "queue-1" },
      {
        resolveUserId: async () => "user-1",
        createSupabaseAdmin: () => supabase as unknown as SupabaseClient,
        ingestExtensionFingerprint: async ({ fingerprint }) => ({
          captured: true,
          chamber: fingerprint.chamber,
          confidenceLevel: 0.6,
          confidenceLabel: "steady",
        }),
        getSubcategory: async () =>
          ({
            id: "sub-1",
            user_id: "user-1",
            name: "Manager Emails",
            parent_chamber: "career",
            aggregate_fingerprint: {},
            confidence_level: 0,
            document_count: 0,
            total_word_count: 0,
            last_trained_at: null,
            evolution_history: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }) as never,
        saveContextMemory: async () => {
          saveCalled = true;
        },
      }
    );

    expect(response.status).toBe(200);
    expect(supabase.mirrorDocuments.get("doc-1")?.subcategory_id).toBe("sub-1");
    expect(saveCalled).toBe(true);
  });

  test("queue classification with subcategory_name creates subcategory and links document", async () => {
    const supabase = new ClassificationSupabase();
    supabase.queueRows.set("queue-1", {
      id: "queue-1",
      user_id: "user-1",
      source_domain: "docs.google.com",
      capture_source: "playground",
      fingerprint_data: {
        ...createFingerprint("general"),
        mirror_document_id: "doc-1",
      },
      word_count: 120,
      captured_at: new Date().toISOString(),
      reviewed: false,
      assigned_chamber: null,
      assigned_at: null,
      context_observations: recommendationObservations() as unknown as Record<string, unknown>,
      ursie_recommendation: null,
      subcategory_id: null,
      subcategory_confirmed: false,
    });
    supabase.mirrorDocuments.set("doc-1", { id: "doc-1", user_id: "user-1" });

    const response = await handleClassifyUnclassified(
      buildClassifyRequest({ chamber: "career", create_domain_rule: false, subcategory_name: "Manager Emails" }),
      { id: "queue-1" },
      {
        resolveUserId: async () => "user-1",
        createSupabaseAdmin: () => supabase as unknown as SupabaseClient,
        ingestExtensionFingerprint: async ({ fingerprint }) => ({
          captured: true,
          chamber: fingerprint.chamber,
          confidenceLevel: 0.6,
          confidenceLabel: "steady",
        }),
        createSubcategory: async () =>
          ({
            id: "sub-new",
            user_id: "user-1",
            name: "Manager Emails",
            parent_chamber: "career",
            aggregate_fingerprint: {},
            confidence_level: 0,
            document_count: 0,
            total_word_count: 0,
            last_trained_at: null,
            evolution_history: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }) as never,
        getSubcategory: async () => null,
        saveContextMemory: async () => {},
      }
    );

    expect(response.status).toBe(200);
    expect(supabase.mirrorDocuments.get("doc-1")?.subcategory_id).toBe("sub-new");
  });

  test("classification with subcategory_name that already exists returns existing subcategory and does not duplicate", async () => {
    const supabase = new ClassificationSupabase();
    supabase.queueRows.set("queue-1", {
      id: "queue-1",
      user_id: "user-1",
      source_domain: "docs.google.com",
      capture_source: "playground",
      fingerprint_data: {
        ...createFingerprint("general"),
        mirror_document_id: "doc-1",
      },
      word_count: 120,
      captured_at: new Date().toISOString(),
      reviewed: false,
      assigned_chamber: null,
      assigned_at: null,
      context_observations: recommendationObservations() as unknown as Record<string, unknown>,
      ursie_recommendation: null,
      subcategory_id: null,
      subcategory_confirmed: false,
    });
    supabase.mirrorDocuments.set("doc-1", { id: "doc-1", user_id: "user-1" });
    let createCalls = 0;

    const response = await handleClassifyUnclassified(
      buildClassifyRequest({ chamber: "career", create_domain_rule: false, subcategory_name: "Manager Emails" }),
      { id: "queue-1" },
      {
        resolveUserId: async () => "user-1",
        createSupabaseAdmin: () => supabase as unknown as SupabaseClient,
        ingestExtensionFingerprint: async ({ fingerprint }) => ({
          captured: true,
          chamber: fingerprint.chamber,
          confidenceLevel: 0.6,
          confidenceLabel: "steady",
        }),
        createSubcategory: async () => {
          createCalls += 1;
          return {
            id: "sub-existing",
            user_id: "user-1",
            name: "Manager Emails",
            parent_chamber: "career",
            aggregate_fingerprint: {},
            confidence_level: 0,
            document_count: 0,
            total_word_count: 0,
            last_trained_at: null,
            evolution_history: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as never;
        },
        saveContextMemory: async () => {},
      }
    );

    expect(response.status).toBe(200);
    expect(createCalls).toBe(1);
    expect(supabase.mirrorDocuments.get("doc-1")?.subcategory_id).toBe("sub-existing");
  });

  test("context memory saved to subcategory level when context_observations exist on classified item", async () => {
    const supabase = new ClassificationSupabase();
    supabase.queueRows.set("queue-1", {
      id: "queue-1",
      user_id: "user-1",
      source_domain: "docs.google.com",
      capture_source: "playground",
      fingerprint_data: {
        ...createFingerprint("general"),
        mirror_document_id: "doc-1",
      },
      word_count: 120,
      captured_at: new Date().toISOString(),
      reviewed: false,
      assigned_chamber: null,
      assigned_at: null,
      context_observations: recommendationObservations() as unknown as Record<string, unknown>,
      ursie_recommendation: null,
      subcategory_id: null,
      subcategory_confirmed: false,
    });
    supabase.mirrorDocuments.set("doc-1", { id: "doc-1", user_id: "user-1" });
    const saves: Array<{ userId: string; subcategoryId: string }> = [];

    await handleClassifyUnclassified(
      buildClassifyRequest({ chamber: "career", create_domain_rule: false, subcategory_id: "sub-1" }),
      { id: "queue-1" },
      {
        resolveUserId: async () => "user-1",
        createSupabaseAdmin: () => supabase as unknown as SupabaseClient,
        ingestExtensionFingerprint: async ({ fingerprint }) => ({
          captured: true,
          chamber: fingerprint.chamber,
          confidenceLevel: 0.6,
          confidenceLabel: "steady",
        }),
        getSubcategory: async () =>
          ({
            id: "sub-1",
            user_id: "user-1",
            name: "Manager Emails",
            parent_chamber: "career",
            aggregate_fingerprint: {},
            confidence_level: 0,
            document_count: 0,
            total_word_count: 0,
            last_trained_at: null,
            evolution_history: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }) as never,
        saveContextMemory: async (userId, subcategoryId) => {
          saves.push({ userId, subcategoryId });
        },
      }
    );

    expect(saves).toEqual([{ userId: "user-1", subcategoryId: "sub-1" }]);
  });

  test("queue classification with neither subcategory field classifies to chamber only", async () => {
    const supabase = new ClassificationSupabase();
    supabase.queueRows.set("queue-1", {
      id: "queue-1",
      user_id: "user-1",
      source_domain: "docs.google.com",
      capture_source: "extension",
      fingerprint_data: createFingerprint("general") as unknown as Record<string, unknown>,
      word_count: 120,
      captured_at: new Date().toISOString(),
      reviewed: false,
      assigned_chamber: null,
      assigned_at: null,
      context_observations: {} as Record<string, unknown>,
      ursie_recommendation: null,
      subcategory_id: null,
      subcategory_confirmed: false,
    });

    const response = await handleClassifyUnclassified(
      buildClassifyRequest({ chamber: "academic", create_domain_rule: false }),
      { id: "queue-1" },
      {
        resolveUserId: async () => "user-1",
        createSupabaseAdmin: () => supabase as unknown as SupabaseClient,
        ingestExtensionFingerprint: async ({ fingerprint }) => ({
          captured: true,
          chamber: fingerprint.chamber,
          confidenceLevel: 0.6,
          confidenceLabel: "steady",
        }),
      }
    );

    expect(response.status).toBe(200);
    expect(supabase.queueRows.get("queue-1")?.assigned_chamber).toBe("academic");
    expect(supabase.queueRows.get("queue-1")?.subcategory_id).toBe(null);
    expect(supabase.mirrorDocuments.size).toBe(0);
  });
});
