import { expect, test, type Page } from "playwright/test";
import { NextRequest } from "next/server.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { handleUpdatePlaygroundSession } from "@/app/api/mirror/playground/session/[id]/handler";
import { handleGeneratePlayground } from "@/app/api/mirror/playground/generate/handler";
import { handlePlaygroundFeedback } from "@/app/api/mirror/playground/feedback/handler";

const FORBIDDEN_URSIE_PHRASES = [
  "pressure points",
  "static",
  "voice profile",
  "mirror mode",
  "i listen for",
  "i help you",
  "my purpose is",
  "i understand",
  "i apologize",
  "i'm sorry",
  "certainly",
  "of course",
  "absolutely",
];

type PlaygroundMessage = {
  id: string;
  role: "ursie" | "user";
  text: string;
};

type SessionRecord = {
  id: string;
  user_id: string;
  messages: PlaygroundMessage[];
  context_memory: Record<string, unknown>;
  chamber: string | null;
  conversation_onboarding?: boolean;
  pending_queue_acknowledgment?: boolean;
  acknowledgment_redirect_count?: number;
  patience_exhausted?: boolean;
  low_quality_response_count?: number;
  generation_request?: Record<string, unknown> | null;
  generic_output?: string | null;
  voiced_output?: string | null;
  feedback_signals?: unknown[];
  confirmation_sent?: boolean;
  updated_at: string;
  created_at?: string;
};

type VoiceChamberRecord = {
  user_id: string;
  chamber: string;
  aggregate_fingerprint: Record<string, unknown>;
  confidence_level: number;
  document_count: number;
};

async function enableE2EAuth(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("e2e-auth", "1");
  });
}

function containsForbiddenPhrase(text: string) {
  const lower = text.toLowerCase();
  return FORBIDDEN_URSIE_PHRASES.some((phrase) => lower.includes(phrase));
}

function createFingerprint() {
  return {
    rhythm: { avgSentenceLength: 14, sentenceVariation: 5, shortSentenceRatio: 0.2 },
    vocabulary: {
      complexWordRatio: 0.12,
      contractionRatio: 0.02,
      topWords: ["deadline", "scope"],
    },
    voice: {
      formalityScore: 0.58,
      assertiveDensity: 0.01,
      hedgeDensity: 0.004,
      personalPronounRate: 0.03,
      activeVoiceRatio: 0.8,
    },
    punctuation: {
      exclamationRate: 0,
      questionRate: 0,
      dashRate: 0,
      semicolonRate: 0,
      ellipsisRate: 0,
    },
    rhetoric: {
      transitionWordRate: 0.1,
      questionOpenerRate: 0,
      listUsageRate: 0,
      exampleUsageRate: 0,
    },
  };
}

async function mockPlaygroundPersonalityBoot(page: Page, options?: { profileExists?: boolean }) {
  const openingCalls: Array<Record<string, unknown>> = [];
  const patchBodies: Array<Record<string, unknown>> = [];
  const chatBodies: Array<Record<string, unknown>> = [];
  const generateBodies: Array<Record<string, unknown>> = [];

  await page.route("**/api/mirror/playground/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ session_id: "session-1" }),
    });
  });

  await page.route("**/api/mirror/playground/session/session-1", async (route) => {
    if (route.request().method() === "PATCH") {
      patchBodies.push(route.request().postDataJSON() as Record<string, unknown>);
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    });
  });

  await page.route("**/api/mirror-mode/voice/profile?includeFingerprint=false", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, exists: options?.profileExists ?? false }),
    });
  });

  await page.route("**/api/mirror-mode/ursie/chat", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    chatBodies.push(body);

    if (chatBodies.length === 1) {
      openingCalls.push(body);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          sessionId: "ursie-1",
          message: "Morgan. What do you need.",
          ready_to_generate: false,
          extracted_context: {},
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        sessionId: "ursie-1",
        message: "Morgan. Sarah at TechTrade. I have enough. Going now.",
        ready_to_generate: true,
        extracted_context: {
          audience: "Sarah at TechTrade Inc",
          purpose: "letter of absence",
          tone: "professional and direct",
          names: ["Sarah"],
          companies: ["TechTrade Inc"],
          writing_type: "letter of absence",
        },
      }),
    });
  });

  await page.route("**/api/mirror/playground/generate", async (route) => {
    generateBodies.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        generic_output: "Generic draft.",
        voiced_output: "Voiced draft.",
        confidence_context: null,
        zero_captures_state: false,
        ready: true,
      }),
    });
  });

  await page.route("**/api/mirror/playground/reveal", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        generic_label: "Morgan. This is what the draft sounds like before I know your hand.",
        reveal_statement:
          "Morgan. You said Sarah, then TechTrade, and that changed the register immediately. That is why this one lands with more spine.",
      }),
    });
  });

  return {
    openingCalls,
    patchBodies,
    chatBodies,
    generateBodies,
  };
}

class PersonalitySessionSupabase {
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
}

class PersonalityGenerateSupabase {
  sessions = new Map<string, SessionRecord>();
  voiceChambers = new Map<string, VoiceChamberRecord>();

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

class PersonalityFeedbackSupabase {
  sessions = new Map<string, SessionRecord>();
  voiceChambers = new Map<string, Record<string, unknown>>();
  feedbackLogs: Array<Record<string, unknown>> = [];

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

    if (table === "mirror_documents") {
      return {
        async insert() {
          return { error: null };
        },
      };
    }

    throw new Error(`Unexpected table ${table}`);
  }
}

function buildPatchRequest(messages: PlaygroundMessage[]) {
  return new NextRequest("http://localhost:3000/api/mirror/playground/session/session-1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages }),
  });
}

function buildGenerateRequest(sessionId: string) {
  return new NextRequest("http://localhost:3000/api/mirror/playground/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      session_id: sessionId,
      chamber: "career",
      audience: "Sarah at TechTrade Inc",
      purpose: "letter of absence",
      tone: "professional and direct",
      content: "I need to write a letter of absence to Sarah from TechTrade Inc.",
      enrichment: {
        user_name: "Morgan",
        writing_type: "letter of absence",
      },
    }),
  });
}

function buildFeedbackRequest() {
  return new NextRequest("http://localhost:3000/api/mirror/playground/feedback", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      session_id: "session-1",
      what_felt_off: "tone",
      original_output: "Original voiced output that felt wrong.",
      chamber: "career",
    }),
  });
}

test.describe("mirror ursie personality", () => {
  test("opening message generation call is made on playground boot, contains user's name, and avoids forbidden phrases", async ({
    page,
  }) => {
    await enableE2EAuth(page);
    const mocks = await mockPlaygroundPersonalityBoot(page, { profileExists: false });

    await page.goto("/mirror/playground");

    const opening = page.getByText("Morgan. What do you need.");
    await expect(opening).toBeVisible();
    expect(mocks.openingCalls).toHaveLength(1);
    expect(String(mocks.openingCalls[0]?.message || "")).toContain("Address the user as");
    expect(containsForbiddenPhrase(await opening.textContent() || "")).toBe(false);
  });

  test("when user message contains a name and company, Ursie flow persists conversation history, returns structured fields, and triggers generation automatically", async ({
    page,
  }) => {
    await enableE2EAuth(page);
    const mocks = await mockPlaygroundPersonalityBoot(page, { profileExists: false });

    await page.goto("/mirror/playground");
    await expect(page.getByText("Morgan. What do you need.")).toBeVisible();

    await page
      .getByTestId("playground-input")
      .fill("I need to write a letter of absence to Sarah from TechTrade Inc.");
    await page.getByTestId("playground-send").click();

    await expect(page.getByTestId("generic-output-card")).toBeVisible();

    const persistedMessages = mocks.patchBodies.find((body) =>
      Array.isArray(body.messages) &&
      (body.messages as Array<Record<string, unknown>>).some(
        (message) => typeof message.text === "string" && String(message.text).includes("TechTrade Inc")
      )
    );

    expect(persistedMessages).toBeTruthy();
    expect(mocks.chatBodies[1]?.sessionId).toBe("ursie-1");
    expect(String(mocks.chatBodies[1]?.message || "")).toContain("Sarah");
    expect(mocks.generateBodies).toHaveLength(1);
    expect(mocks.generateBodies[0]).toMatchObject({
      audience: "Sarah at TechTrade Inc",
      purpose: "letter of absence",
      tone: "professional and direct",
    });
  });

  test("three consecutive low-quality responses set patience_exhausted, return ursie_response, and avoid forbidden phrases", async () => {
    const supabase = new PersonalitySessionSupabase();
    supabase.sessions.set("session-1", {
      id: "session-1",
      user_id: "user-1",
      messages: [
        {
          id: "ursie-1",
          role: "ursie",
          text: "Morgan. Who is this for?",
        },
      ],
      context_memory: { user_name: "Morgan" },
      chamber: "career",
      pending_queue_acknowledgment: false,
      acknowledgment_redirect_count: 0,
      patience_exhausted: false,
      low_quality_response_count: 0,
      updated_at: new Date().toISOString(),
    });

    for (const [index, text] of ["I don't know", "whatever", "just do it"].entries()) {
      const response = await handleUpdatePlaygroundSession(
        buildPatchRequest([
          ...supabase.sessions.get("session-1")!.messages,
          {
            id: `user-${index + 1}`,
            role: "user",
            text,
          },
        ]),
        { id: "session-1" },
        {
          resolveUserId: async () => "user-1",
          createSupabaseServerClient: () => supabase as unknown as SupabaseClient,
          shouldIngest: () => false,
          ingestConversationMessage: async () => undefined,
        }
      );

      if (index < 2) {
        expect(response.status).toBe(200);
      } else {
        const payload = await response.json();
        expect(payload.ursie_response).toBeTruthy();
        expect(containsForbiddenPhrase(String(payload.ursie_response))).toBe(false);
      }
    }

    expect(supabase.sessions.get("session-1")?.patience_exhausted).toBe(true);
  });

  test("substantive message when patience_exhausted is true resets state and processes normally", async () => {
    const supabase = new PersonalitySessionSupabase();
    supabase.sessions.set("session-1", {
      id: "session-1",
      user_id: "user-1",
      messages: [
        {
          id: "ursie-1",
          role: "ursie",
          text: "Morgan. Who is this for?",
        },
      ],
      context_memory: { user_name: "Morgan" },
      chamber: "career",
      pending_queue_acknowledgment: false,
      acknowledgment_redirect_count: 0,
      patience_exhausted: true,
      low_quality_response_count: 0,
      updated_at: new Date().toISOString(),
    });

    const response = await handleUpdatePlaygroundSession(
      buildPatchRequest([
        ...supabase.sessions.get("session-1")!.messages,
        {
          id: "user-1",
          role: "user",
          text:
            "I need this to go to Sarah at TechTrade next Tuesday because I am asking for a formal leave letter and I need it direct, clean, and not apologetic.",
        },
      ]),
      { id: "session-1" },
      {
        resolveUserId: async () => "user-1",
        createSupabaseServerClient: () => supabase as unknown as SupabaseClient,
        shouldIngest: () => false,
        ingestConversationMessage: async () => undefined,
      }
    );

    expect(response.status).toBe(200);
    expect(supabase.sessions.get("session-1")?.patience_exhausted).toBe(false);
    expect(supabase.sessions.get("session-1")?.low_quality_response_count).toBe(0);
  });

  test("new user generate call returns output directly with no confirmation field", async () => {
    const supabase = new PersonalityGenerateSupabase();
    supabase.sessions.set("session-1", {
      id: "session-1",
      user_id: "user-1",
      messages: [],
      context_memory: {},
      chamber: null,
      generation_request: null,
      generic_output: null,
      voiced_output: null,
      feedback_signals: [],
      confirmation_sent: false,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    });

    const response = await handleGeneratePlayground(buildGenerateRequest("session-1"), {
      resolveUserId: async () => "user-1",
      createSupabaseServerClient: () => supabase as unknown as SupabaseClient,
      runClaude: async ({ system }) =>
        system.includes("Write clear, competent, professional prose.")
          ? "generic output"
          : "voiced output",
    });

    const payload = await response.json();
    expect(payload.confirmation).toBeUndefined();
    expect(payload.generic_output).toBeNull();
    expect(payload.voiced_output).toBeNull();
    expect(payload.zero_captures_state).toBe(true);
  });

  test("returning user first generate call returns confirmation and ready false", async () => {
    const supabase = new PersonalityGenerateSupabase();
    supabase.sessions.set("session-1", {
      id: "session-1",
      user_id: "user-1",
      messages: [],
      context_memory: { user_name: "Morgan", writing_type: "letter of absence" },
      chamber: null,
      generation_request: null,
      generic_output: null,
      voiced_output: null,
      feedback_signals: [],
      confirmation_sent: false,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    });
    supabase.voiceChambers.set("user-1:career", {
      user_id: "user-1",
      chamber: "career",
      aggregate_fingerprint: createFingerprint(),
      confidence_level: 62,
      document_count: 4,
    });

    const response = await handleGeneratePlayground(buildGenerateRequest("session-1"), {
      resolveUserId: async () => "user-1",
      createSupabaseServerClient: () => supabase as unknown as SupabaseClient,
      runClaude: async () =>
        "Morgan. Letter of absence for Sarah at TechTrade Inc. Going now.",
    });

    const payload = await response.json();
    expect(payload.ready).toBe(false);
    expect(String(payload.confirmation || "")).toContain("Morgan");
  });

  test("returning user second call after confirmation_sent true returns output directly", async () => {
    const supabase = new PersonalityGenerateSupabase();
    supabase.sessions.set("session-1", {
      id: "session-1",
      user_id: "user-1",
      messages: [],
      context_memory: { user_name: "Morgan", writing_type: "letter of absence" },
      chamber: null,
      generation_request: null,
      generic_output: null,
      voiced_output: null,
      feedback_signals: [],
      confirmation_sent: true,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    });
    supabase.voiceChambers.set("user-1:career", {
      user_id: "user-1",
      chamber: "career",
      aggregate_fingerprint: createFingerprint(),
      confidence_level: 62,
      document_count: 4,
    });

    const response = await handleGeneratePlayground(buildGenerateRequest("session-1"), {
      resolveUserId: async () => "user-1",
      createSupabaseServerClient: () => supabase as unknown as SupabaseClient,
      runClaude: async ({ system }) =>
        system.includes("Write clear, competent, professional prose.")
          ? "generic output"
          : "voiced output",
    });

    const payload = await response.json();
    expect(payload.confirmation).toBeUndefined();
    expect(payload.ready).toBe(true);
    expect(payload.generic_output).toBe("generic output");
    expect(payload.voiced_output).toBe("voiced output");
  });

  test("feedback endpoint returns ursie_feedback_response without forbidden phrases, and generation failure does not block regeneration", async () => {
    const supabase = new PersonalityFeedbackSupabase();
    supabase.sessions.set("session-1", {
      id: "session-1",
      user_id: "user-1",
      messages: [
        {
          id: "user-1",
          role: "user",
          text: "I need this to go to Sarah at TechTrade.",
        },
      ],
      context_memory: {},
      chamber: "career",
      generation_request: {
        audience: "Sarah at TechTrade",
        purpose: "letter of absence",
        tone: "professional and direct",
        content: "I need to ask for leave without sounding weak.",
        enrichment: { user_name: "Morgan" },
      },
      voiced_output: "Original voiced output that felt wrong.",
      feedback_signals: [],
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    });
    supabase.voiceChambers.set("user-1:career", {
      aggregate_fingerprint: createFingerprint(),
      confidence_level: 62,
    });

    let callCount = 0;
    const response = await handlePlaygroundFeedback(buildFeedbackRequest(), {
      resolveUserId: async () => "user-1",
      createSupabaseServerClient: () => supabase as unknown as SupabaseClient,
      runClaude: async ({ prompt }) => {
        callCount += 1;
        if (prompt.includes("Write Ursie's response before she fixes the draft.")) {
          throw new Error("feedback generation failed");
        }
        return "Regenerated voiced output";
      },
    });

    const payload = await response.json();
    expect(callCount).toBe(2);
    expect(payload.regenerated_output).toBe("Regenerated voiced output");
    expect(payload.ursie_feedback_response).toBeNull();
  });

  test("feedback endpoint returns ursie_feedback_response field and it avoids forbidden phrases", async () => {
    const supabase = new PersonalityFeedbackSupabase();
    supabase.sessions.set("session-1", {
      id: "session-1",
      user_id: "user-1",
      messages: [
        {
          id: "user-1",
          role: "user",
          text: "I need this to go to Sarah at TechTrade.",
        },
      ],
      context_memory: {},
      chamber: "career",
      generation_request: {
        audience: "Sarah at TechTrade",
        purpose: "letter of absence",
        tone: "professional and direct",
        content: "I need to ask for leave without sounding weak.",
        enrichment: { user_name: "Morgan" },
      },
      voiced_output: "Original voiced output that felt wrong.",
      feedback_signals: [],
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    });
    supabase.voiceChambers.set("user-1:career", {
      aggregate_fingerprint: createFingerprint(),
      confidence_level: 62,
    });

    const response = await handlePlaygroundFeedback(buildFeedbackRequest(), {
      resolveUserId: async () => "user-1",
      createSupabaseServerClient: () => supabase as unknown as SupabaseClient,
      runClaude: async ({ prompt }) =>
        prompt.includes("Write Ursie's response before she fixes the draft.")
          ? "Morgan. I heard Sarah and pushed the formality too far."
          : "Regenerated voiced output",
    });

    const payload = await response.json();
    expect(payload.ursie_feedback_response).toContain("Morgan");
    expect(containsForbiddenPhrase(String(payload.ursie_feedback_response))).toBe(false);
  });
});
