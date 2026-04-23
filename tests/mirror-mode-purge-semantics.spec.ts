import { expect, test } from "playwright/test";
import { NextRequest } from "next/server.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { handleMirrorPurgePost } from "@/app/api/mirror/purge/handler";

type Doc = {
  id: string;
  user_id: string;
  writing_type: string;
  training_allowed?: boolean | null;
  excluded_from_profile?: boolean | null;
  deleted_at?: string | null;
  visibility_status?: string | null;
  file_name?: string | null;
  word_count?: number | null;
  created_at?: string | null;
};

type Content = {
  document_id: string;
  extracted_text: string | null;
};

type QueueItem = {
  id: string;
  user_id: string;
  assigned_chamber: string | null;
};

type Consent = {
  id: string;
  user_id: string;
  studio: string;
};

class PurgeSupabase {
  docs: Doc[];
  contents: Content[];
  queue: QueueItem[];
  chambers: Array<Record<string, unknown>>;
  consent: Consent[];

  constructor(seed: {
    docs: Doc[];
    contents: Content[];
    queue: QueueItem[];
    chambers?: Array<Record<string, unknown>>;
    consent?: Consent[];
  }) {
    this.docs = [...seed.docs];
    this.contents = [...seed.contents];
    this.queue = [...seed.queue];
    this.chambers = [...(seed.chambers || [])];
    this.consent = [...(seed.consent || [])];
  }

  from(table: string) {
    if (table === "mirror_documents") {
      const self = this;
      let filters: Array<{ column: string; value: string | boolean }> = [];
      return {
        select() {
          const query = {
            eq(column: string, value: string | boolean) {
              filters.push({ column, value });
              return query;
            },
            async maybeSingle() {
              return { data: null, error: null };
            },
            then(
              resolve: (value: { data: Doc[]; error: null }) => unknown,
              reject?: (reason?: unknown) => unknown
            ) {
              const data = self.docs.filter((doc) =>
                filters.every((filter) => (doc as Record<string, unknown>)[filter.column] === filter.value)
              );
              return Promise.resolve({ data, error: null }).then(resolve, reject);
            },
          };
          return query;
        },
        delete() {
          const chain = {
            in(column: string, values: string[]) {
              self.docs = self.docs.filter(
                (doc) =>
                  !(
                    values.includes(String((doc as any)[column])) &&
                    filters.every((f) => (doc as any)[f.column] === f.value)
                  )
              );
              return {
                async eq(nextColumn: string, nextValue: string) {
                  filters.push({ column: nextColumn, value: nextValue });
                  self.docs = self.docs.filter(
                    (doc) =>
                      !(
                        values.includes(String((doc as any)[column])) &&
                        filters.every((f) => (doc as any)[f.column] === f.value)
                      )
                  );
                  return { error: null };
                },
              };
            },
            async eq(column: string, value: string) {
              self.docs = self.docs.filter((doc) => (doc as any)[column] !== value);
              return { error: null };
            },
          };
          return chain;
        },
      };
    }

    if (table === "mirror_document_content") {
      const self = this;
      return {
        select() {
          return {
            in(_column: string, ids: string[]) {
              return Promise.resolve({
                data: self.contents.filter((row) => ids.includes(row.document_id)),
                error: null,
              });
            },
          };
        },
        delete() {
          return {
            async in(_column: string, ids: string[]) {
              self.contents = self.contents.filter((row) => !ids.includes(row.document_id));
              return { error: null };
            },
          };
        },
      };
    }

    if (table === "mirror_unclassified_queue") {
      const self = this;
      let filters: Array<{ column: string; value: string }> = [];
      return {
        delete() {
          return {
            eq(column: string, value: string) {
              filters.push({ column, value });
              const query = {
                async eq(nextColumn: string, nextValue: string) {
                  filters.push({ column: nextColumn, value: nextValue });
                  self.queue = self.queue.filter((item) => !filters.every((f) => (item as any)[f.column] === f.value));
                  return { error: null };
                },
                then(
                  resolve: (value: { error: null }) => unknown,
                  reject?: (reason?: unknown) => unknown
                ) {
                  self.queue = self.queue.filter(
                    (item) => !filters.every((f) => (item as any)[f.column] === f.value)
                  );
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
      return {
        delete() {
          return {
            async eq(column: string, value: string) {
              self.chambers = self.chambers.filter((row) => (row as any)[column] !== value);
              return { error: null };
            },
          };
        },
        async insert(rows: Array<Record<string, unknown>>) {
          self.chambers = [...rows];
          return { error: null };
        },
      };
    }

    throw new Error(`Unexpected table ${table}`);
  }
}

function buildRequest(scope: string) {
  return new NextRequest("http://localhost:3000/api/mirror/purge", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ scope, confirmation: "DELETE" }),
  });
}

test.describe("mirror-mode purge semantics", () => {
  test("per-chamber purge deletes only that chamber's docs, queue items, and recalculated chamber rows", async () => {
    const supabase = new PurgeSupabase({
      docs: [
        {
          id: "doc-career",
          user_id: "user-1",
          writing_type: "professional",
          training_allowed: true,
          excluded_from_profile: false,
          visibility_status: "active",
          deleted_at: null,
          file_name: "Career",
          word_count: 120,
          created_at: "2026-03-22T12:00:00.000Z",
        },
        {
          id: "doc-academic",
          user_id: "user-1",
          writing_type: "academic",
          training_allowed: true,
          excluded_from_profile: false,
          visibility_status: "active",
          deleted_at: null,
          file_name: "Academic",
          word_count: 120,
          created_at: "2026-03-22T12:00:00.000Z",
        },
      ],
      contents: [
        { document_id: "doc-career", extracted_text: "career ".repeat(120) },
        { document_id: "doc-academic", extracted_text: "academic ".repeat(120) },
      ],
      queue: [
        { id: "q-career", user_id: "user-1", assigned_chamber: "career" },
        { id: "q-general", user_id: "user-1", assigned_chamber: "general" },
      ],
      chambers: [{ user_id: "user-1", chamber: "career" }, { user_id: "user-1", chamber: "academic" }],
      consent: [{ id: "consent-career", user_id: "user-1", studio: "career" }],
    });

    const response = await handleMirrorPurgePost(buildRequest("career"), {
      resolveUserId: async () => "user-1",
      createSupabase: () => supabase as unknown as SupabaseClient,
    });

    expect(response.status).toBe(200);
    expect(supabase.docs.map((doc) => doc.id)).toEqual(["doc-academic"]);
    expect(supabase.contents.map((row) => row.document_id)).toEqual(["doc-academic"]);
    expect(supabase.queue.map((item) => item.id)).toEqual(["q-general"]);
    expect(supabase.consent).toEqual([{ id: "consent-career", user_id: "user-1", studio: "career" }]);
  });

  test("full purge removes all voice data for user", async () => {
    const supabase = new PurgeSupabase({
      docs: [
        { id: "doc-1", user_id: "user-1", writing_type: "general" },
        { id: "doc-2", user_id: "user-1", writing_type: "academic" },
      ],
      contents: [
        { document_id: "doc-1", extracted_text: "one" },
        { document_id: "doc-2", extracted_text: "two" },
      ],
      queue: [
        { id: "q-1", user_id: "user-1", assigned_chamber: "general" },
        { id: "q-2", user_id: "user-1", assigned_chamber: "academic" },
      ],
      chambers: [
        { user_id: "user-1", chamber: "general" },
        { user_id: "user-1", chamber: "overall" },
      ],
      consent: [{ id: "consent-general", user_id: "user-1", studio: "general" }],
    });

    const response = await handleMirrorPurgePost(buildRequest("all"), {
      resolveUserId: async () => "user-1",
      createSupabase: () => supabase as unknown as SupabaseClient,
    });

    expect(response.status).toBe(200);
    expect(supabase.docs).toEqual([]);
    expect(supabase.contents).toEqual([]);
    expect(supabase.queue).toEqual([]);
    expect(supabase.chambers).toEqual([]);
  });

  test("purge does not delete mirror_mode_consent records", async () => {
    const consent = [{ id: "consent-general", user_id: "user-1", studio: "general" }];
    const supabase = new PurgeSupabase({
      docs: [{ id: "doc-1", user_id: "user-1", writing_type: "general" }],
      contents: [{ document_id: "doc-1", extracted_text: "one" }],
      queue: [{ id: "q-1", user_id: "user-1", assigned_chamber: "general" }],
      chambers: [{ user_id: "user-1", chamber: "general" }],
      consent,
    });

    await handleMirrorPurgePost(buildRequest("all"), {
      resolveUserId: async () => "user-1",
      createSupabase: () => supabase as unknown as SupabaseClient,
    });

    expect(supabase.consent).toEqual(consent);
  });
});
