import { expect, test } from "playwright/test";
import { NextRequest } from "next/server.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  handleUpdatePlaygroundSession,
} from "@/app/api/mirror/playground/session/[id]/handler";
import {
  ingestConversationMessageWithDeps,
} from "@/lib/mirror-mode/playgroundIngestion";
import { SOURCE_AUTHORITY } from "@/lib/mirror-core/sourceAuthority";

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

function buildPatchRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost:3000/api/mirror/playground/session/session-1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function baseSession(overrides?: Partial<SessionRecord>): SessionRecord {
  return {
    id: "session-1",
    user_id: "user-1",
    messages: [],
    context_memory: {},
    chamber: null,
    conversation_onboarding: false,
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

test.describe("mirror playground wiring", () => {
  test("user message over threshold and substantive -> ingestConversationMessage called", async () => {
    const supabase = new PlaygroundSessionSupabase();
    supabase.sessions.set("session-1", baseSession());
    const calls: Array<Record<string, unknown>> = [];

    const response = await handleUpdatePlaygroundSession(
      buildPatchRequest({
        messages: [
          {
            id: "msg-1",
            role: "user",
            text: "I need this email to explain why the deadline moved, because my manager keeps reading urgency as if it erases the extra scope my team absorbed this week.",
          },
        ],
      }),
      { id: "session-1" },
      {
        resolveUserId: async () => "user-1",
        createSupabaseServerClient: () => supabase as unknown as SupabaseClient,
        shouldIngest: () => true,
        ingestConversationMessage: async (userId, message, chamber, sessionId) => {
          calls.push({ userId, message, chamber, sessionId });
        },
      }
    );

    expect(response.status).toBe(200);
    expect(calls).toEqual([
      {
        userId: "user-1",
        message:
          "I need this email to explain why the deadline moved, because my manager keeps reading urgency as if it erases the extra scope my team absorbed this week.",
        chamber: "general",
        sessionId: "session-1",
      },
    ]);
  });

  test("user message under threshold -> ingestConversationMessage not called", async () => {
    const supabase = new PlaygroundSessionSupabase();
    supabase.sessions.set("session-1", baseSession());
    let called = false;

    await handleUpdatePlaygroundSession(
      buildPatchRequest({
        messages: [{ id: "msg-1", role: "user", text: "Too short to keep." }],
      }),
      { id: "session-1" },
      {
        resolveUserId: async () => "user-1",
        createSupabaseServerClient: () => supabase as unknown as SupabaseClient,
        shouldIngest: () => false,
        ingestConversationMessage: async () => {
          called = true;
        },
      }
    );

    expect(called).toBe(false);
  });

  test("Ursie message -> ingestConversationMessage never called regardless of content", async () => {
    const supabase = new PlaygroundSessionSupabase();
    supabase.sessions.set("session-1", baseSession());
    let called = false;

    await handleUpdatePlaygroundSession(
      buildPatchRequest({
        messages: [
          {
            id: "msg-1",
            role: "ursie",
            text: "I need this email to explain why the deadline moved, because my manager keeps reading urgency as if it erases the extra scope my team absorbed this week.",
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

  test("generated output never reaches ingestion pipeline", async () => {
    const supabase = new PlaygroundSessionSupabase();
    supabase.sessions.set(
      "session-1",
      baseSession({
        messages: [
          { id: "msg-1", role: "user", text: "Original user message already stored." },
          { id: "msg-2", role: "ursie", text: "Generated output that should never be learned." },
        ],
      })
    );
    let called = false;

    await handleUpdatePlaygroundSession(
      buildPatchRequest({
        messages: [
          { id: "msg-1", role: "user", text: "Original user message already stored." },
          { id: "msg-2", role: "ursie", text: "Generated output that should never be learned." },
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

  test("confirmed chamber used for ingestion after chamber confirmation", async () => {
    const supabase = new PlaygroundSessionSupabase();
    supabase.sessions.set("session-1", baseSession({ chamber: "career" }));
    const calls: string[] = [];

    await handleUpdatePlaygroundSession(
      buildPatchRequest({
        messages: [
          {
            id: "msg-1",
            role: "user",
            text: "I need this note to explain why the client changed scope, because the team absorbed the new work without changing the deadline or the staffing plan.",
          },
        ],
      }),
      { id: "session-1" },
      {
        resolveUserId: async () => "user-1",
        createSupabaseServerClient: () => supabase as unknown as SupabaseClient,
        shouldIngest: () => true,
        ingestConversationMessage: async (_userId, _message, chamber) => {
          calls.push(chamber);
        },
      }
    );

    expect(calls).toEqual(["career"]);
  });

  test("general used for ingestion before chamber is confirmed", async () => {
    const supabase = new PlaygroundSessionSupabase();
    supabase.sessions.set("session-1", baseSession({ chamber: null }));
    const calls: string[] = [];

    await handleUpdatePlaygroundSession(
      buildPatchRequest({
        messages: [
          {
            id: "msg-1",
            role: "user",
            text: "I need this email to explain why the timeline slipped, because the vendor missed two milestones and my team had to rebuild the rollout plan from the middle.",
          },
        ],
      }),
      { id: "session-1" },
      {
        resolveUserId: async () => "user-1",
        createSupabaseServerClient: () => supabase as unknown as SupabaseClient,
        shouldIngest: () => true,
        ingestConversationMessage: async (_userId, _message, chamber) => {
          calls.push(chamber);
        },
      }
    );

    expect(calls).toEqual(["general"]);
  });

  test("conversation_onboarding: true session ingests qualifying messages immediately", async () => {
    const supabase = new PlaygroundSessionSupabase();
    supabase.sessions.set(
      "session-1",
      baseSession({
        conversation_onboarding: true,
      })
    );
    const calls: Array<Record<string, unknown>> = [];

    await handleUpdatePlaygroundSession(
      buildPatchRequest({
        conversation_onboarding: true,
        messages: [
          {
            id: "msg-1",
            role: "user",
            text: "I am working on a note to my manager about a deadline shift, because the project changed shape after the client introduced new approval steps and my team needs room to respond cleanly.",
          },
        ],
      }),
      { id: "session-1" },
      {
        resolveUserId: async () => "user-1",
        createSupabaseServerClient: () => supabase as unknown as SupabaseClient,
        shouldIngest: () => true,
        ingestConversationMessage: async (userId, message, chamber, sessionId) => {
          calls.push({ userId, message, chamber, sessionId });
        },
      }
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]?.chamber).toBe("general");
    expect(supabase.sessions.get("session-1")?.conversation_onboarding).toBe(true);
  });

  test("source authority playground_conversation confirmed on ingested documents", async () => {
    const captured: Array<Record<string, unknown>> = [];

    await ingestConversationMessageWithDeps(
      "user-1",
      "I need this email to explain why the deadline shifted, because my manager is reading urgency as if it cancels the additional scope that landed on the team this week.",
      "general",
      "session-1",
      {
        getSupabaseAdmin: () => ({}) as never,
        ingestStudioWriting: async (params) => {
          captured.push(params as unknown as Record<string, unknown>);
          return {
            captured: true,
            archived: true,
            needsConsent: false,
            mirrorDocumentId: "doc-1",
            wordCount: 29,
          };
        },
      }
    );

    expect(captured).toHaveLength(1);
    expect(captured[0]?.sourceAuthority).toBe(SOURCE_AUTHORITY.PLAYGROUND_CONVERSATION);
    expect(captured[0]?.sourceStudio).toBe("general");
  });
});
