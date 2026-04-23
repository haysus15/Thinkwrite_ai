import { expect, test } from "playwright/test";
import { NextRequest } from "next/server.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { handleUpdatePlaygroundSession } from "@/app/api/mirror/playground/session/[id]/handler";

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

class PlaygroundAcknowledgmentSupabase {
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
          self.queueRows.push(payload);
          return {
            select() {
              return {
                async single() {
                  return { data: { id: "queue-1" }, error: null };
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

function baseSession(overrides?: Partial<SessionRecord>): SessionRecord {
  return {
    id: "session-1",
    user_id: "user-1",
    messages: [
      {
        id: "ursie-1",
        role: "ursie",
        text: "I set something aside in your queue. Look at it before we move on.",
      },
    ],
    context_memory: {},
    chamber: "career",
    conversation_onboarding: false,
    pending_queue_acknowledgment: true,
    acknowledgment_redirect_count: 0,
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function buildPatchRequest(messages: SessionMessage[]) {
  return new NextRequest("http://localhost:3000/api/mirror/playground/session/session-1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages }),
  });
}

test.describe("mirror playground acknowledgment", () => {
  test("acknowledgment message clears pending_queue_acknowledgment and resets count to 0", async () => {
    const supabase = new PlaygroundAcknowledgmentSupabase();
    supabase.sessions.set("session-1", baseSession());
    let ingested = 0;

    const response = await handleUpdatePlaygroundSession(
      buildPatchRequest([
        ...supabase.sessions.get("session-1")!.messages,
        {
          id: "user-1",
          role: "user",
          text: "Got it. I'll check the queue now.",
        },
      ]),
      { id: "session-1" },
      {
        resolveUserId: async () => "user-1",
        createSupabaseServerClient: () => supabase as unknown as SupabaseClient,
        shouldIngest: () => true,
        ingestConversationMessage: async () => {
          ingested += 1;
          return {
            captured: true,
            archived: true,
            needsConsent: false,
            mirrorDocumentId: "doc-1",
            wordCount: 8,
          };
        },
        detectAcknowledgment: () => true,
        extractContextObservations: async () => ({
          people: [],
          writing_type: "",
          relationship_direction: "unknown",
          tone_observed: "",
          recommended_chamber: "general",
          recommended_subcategory: "",
          recommendation_confidence: "low",
          recommendation_reasoning: "",
        }),
      }
    );

    expect(response.status).toBe(200);
    expect(supabase.sessions.get("session-1")?.pending_queue_acknowledgment).toBe(false);
    expect(supabase.sessions.get("session-1")?.acknowledgment_redirect_count).toBe(0);
    expect(ingested).toBe(1);
  });

  test("non-acknowledgment on count 0 to 1 returns redirect response and does not process original request", async () => {
    const supabase = new PlaygroundAcknowledgmentSupabase();
    supabase.sessions.set("session-1", baseSession({ acknowledgment_redirect_count: 0 }));
    let ingested = 0;

    const response = await handleUpdatePlaygroundSession(
      buildPatchRequest([
        ...supabase.sessions.get("session-1")!.messages,
        {
          id: "user-1",
          role: "user",
          text: "Can you draft the email instead?",
        },
      ]),
      { id: "session-1" },
      {
        resolveUserId: async () => "user-1",
        createSupabaseServerClient: () => supabase as unknown as SupabaseClient,
        shouldIngest: () => true,
        ingestConversationMessage: async () => {
          ingested += 1;
          return {
            captured: true,
            archived: true,
            needsConsent: false,
            mirrorDocumentId: "doc-1",
            wordCount: 10,
          };
        },
        detectAcknowledgment: () => false,
        generateRedirectMessage: async ({ redirectCount }) => `Redirect ${redirectCount}`,
      }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ursie_response: "Redirect 1",
      continue_processing: false,
    });
    expect(supabase.sessions.get("session-1")?.acknowledgment_redirect_count).toBe(1);
    expect(ingested).toBe(0);
  });

  test("non-acknowledgment on count 1 to 2 returns firmer redirect response", async () => {
    const supabase = new PlaygroundAcknowledgmentSupabase();
    supabase.sessions.set("session-1", baseSession({ acknowledgment_redirect_count: 1 }));

    const response = await handleUpdatePlaygroundSession(
      buildPatchRequest([
        ...supabase.sessions.get("session-1")!.messages,
        {
          id: "user-1",
          role: "user",
          text: "Write the email now.",
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
          wordCount: 10,
        }),
        detectAcknowledgment: () => false,
        generateRedirectMessage: async ({ redirectCount }) => `Redirect ${redirectCount}`,
      }
    );

    await expect(response.json()).resolves.toMatchObject({
      ursie_response: "Redirect 2",
      continue_processing: false,
    });
    expect(supabase.sessions.get("session-1")?.acknowledgment_redirect_count).toBe(2);
  });

  test("non-acknowledgment on count 2 to 3 returns release message, clears state, then processes original request", async () => {
    const supabase = new PlaygroundAcknowledgmentSupabase();
    supabase.sessions.set("session-1", baseSession({ acknowledgment_redirect_count: 2 }));
    let ingested = 0;

    const response = await handleUpdatePlaygroundSession(
      buildPatchRequest([
        ...supabase.sessions.get("session-1")!.messages,
        {
          id: "user-1",
          role: "user",
          text: "I need this email to explain why Sarah needs the revised deadline, because the team absorbed a new review cycle and the scope changed after signoff.",
        },
      ]),
      { id: "session-1" },
      {
        resolveUserId: async () => "user-1",
        createSupabaseServerClient: () => supabase as unknown as SupabaseClient,
        shouldIngest: () => true,
        ingestConversationMessage: async () => {
          ingested += 1;
          return {
            captured: true,
            archived: true,
            needsConsent: false,
            mirrorDocumentId: "doc-1",
            wordCount: 24,
          };
        },
        detectAcknowledgment: () => false,
        generateRedirectMessage: async ({ redirectCount }) => `Release ${redirectCount}`,
        extractContextObservations: async () => ({
          people: [],
          writing_type: "",
          relationship_direction: "unknown",
          tone_observed: "",
          recommended_chamber: "general",
          recommended_subcategory: "",
          recommendation_confidence: "low",
          recommendation_reasoning: "",
        }),
      }
    );

    await expect(response.json()).resolves.toMatchObject({
      ursie_response: "Release 3",
      continue_processing: true,
    });
    expect(supabase.sessions.get("session-1")?.pending_queue_acknowledgment).toBe(false);
    expect(supabase.sessions.get("session-1")?.acknowledgment_redirect_count).toBe(0);
    expect(ingested).toBe(1);
  });

  test("all redirect responses are non-empty generated strings", async () => {
    const supabase = new PlaygroundAcknowledgmentSupabase();
    supabase.sessions.set("session-1", baseSession());

    const response = await handleUpdatePlaygroundSession(
      buildPatchRequest([
        ...supabase.sessions.get("session-1")!.messages,
        {
          id: "user-1",
          role: "user",
          text: "Can you just do the draft?",
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
          wordCount: 6,
        }),
        detectAcknowledgment: () => false,
        generateRedirectMessage: async () => "I asked you to look at the queue item first.",
      }
    );

    const payload = await response.json();
    expect(payload.ursie_response.length).toBeGreaterThan(0);
  });

  test("release message at count 3 differs from count 1 and count 2 messages", async () => {
    const messages = new Map<number, string>();

    for (const redirectCount of [0, 1, 2]) {
      const supabase = new PlaygroundAcknowledgmentSupabase();
      supabase.sessions.set(
        "session-1",
        baseSession({ acknowledgment_redirect_count: redirectCount })
      );

      const response = await handleUpdatePlaygroundSession(
        buildPatchRequest([
          ...supabase.sessions.get("session-1")!.messages,
          {
            id: `user-${redirectCount}`,
            role: "user",
            text: "Write the draft now.",
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
            wordCount: 8,
          }),
          detectAcknowledgment: () => false,
          generateRedirectMessage: async ({ redirectCount: nextCount }) =>
            nextCount === 1
              ? "First redirect"
              : nextCount === 2
                ? "Second redirect"
                : "I will leave it there for now, but I am keeping it in mind.",
          extractContextObservations: async () => ({
            people: [],
            writing_type: "",
            relationship_direction: "unknown",
            tone_observed: "",
            recommended_chamber: "general",
            recommended_subcategory: "",
            recommendation_confidence: "low",
            recommendation_reasoning: "",
          }),
        }
      );

      const payload = await response.json();
      messages.set(redirectCount + 1, payload.ursie_response);
    }

    expect(messages.get(3)).not.toBe(messages.get(1));
    expect(messages.get(3)).not.toBe(messages.get(2));
  });

  test("pending_queue_acknowledgment false session processes messages normally with no redirect behavior", async () => {
    const supabase = new PlaygroundAcknowledgmentSupabase();
    supabase.sessions.set(
      "session-1",
      baseSession({
        pending_queue_acknowledgment: false,
        acknowledgment_redirect_count: 0,
      })
    );
    let ingested = 0;

    const response = await handleUpdatePlaygroundSession(
      buildPatchRequest([
        ...supabase.sessions.get("session-1")!.messages,
        {
          id: "user-1",
          role: "user",
          text: "I need this email to explain why Sarah needs the revised deadline, because the team absorbed a new review cycle and the scope changed after signoff.",
        },
      ]),
      { id: "session-1" },
      {
        resolveUserId: async () => "user-1",
        createSupabaseServerClient: () => supabase as unknown as SupabaseClient,
        shouldIngest: () => true,
        ingestConversationMessage: async () => {
          ingested += 1;
          return {
            captured: true,
            archived: true,
            needsConsent: false,
            mirrorDocumentId: "doc-1",
            wordCount: 24,
          };
        },
        detectAcknowledgment: () => false,
        generateRedirectMessage: async () => "unused",
        extractContextObservations: async () => ({
          people: [],
          writing_type: "",
          relationship_direction: "unknown",
          tone_observed: "",
          recommended_chamber: "general",
          recommended_subcategory: "",
          recommendation_confidence: "low",
          recommendation_reasoning: "",
        }),
      }
    );

    const payload = await response.json();
    expect(payload.ursie_response).toBeNull();
    expect(ingested).toBe(1);
  });
});
