import { expect, test } from "playwright/test";
import { NextRequest } from "next/server.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ingestExtensionFingerprint, type ExtensionFingerprint } from "@/lib/mirror-core/extension/ingestion";
import { handleReclassifyDocument } from "@/app/api/mirror/documents/[id]/reclassify/handler";

type MirrorDocument = {
  id: string;
  user_id: string;
  file_name: string | null;
  writing_type: string | null;
  word_count: number | null;
  training_allowed?: boolean | null;
  excluded_from_profile?: boolean | null;
  deleted_at?: string | null;
  visibility_status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type MirrorDocumentContent = {
  document_id: string;
  extracted_text: string | null;
};

type VoiceChamberRow = {
  user_id: string;
  chamber: string;
  aggregate_fingerprint: Record<string, unknown>;
  confidence_level: number;
  document_count: number;
  total_word_count: number;
  last_trained_at: string;
  evolution_history: unknown[];
  updated_at: string;
};

function buildFingerprint(chamber: ExtensionFingerprint["chamber"]): ExtensionFingerprint {
  return {
    sessionId: `session-${chamber}`,
    chamber,
    sourceType: "extension",
    capturedAt: "2026-03-22T12:00:00.000Z",
    wordCount: 120,
    avgSentenceLength: 13,
    sentenceLengthVariance: 2,
    avgParagraphLength: 4,
    shortSentenceRate: 0.2,
    longSentenceRate: 0.1,
    lexicalDensity: 0.52,
    avgWordLength: 4.6,
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

class IntegritySupabase {
  voiceProfiles = new Map<string, Record<string, unknown>>();
  voiceChambers = new Map<string, VoiceChamberRow>();
  mirrorDocuments: MirrorDocument[] = [];
  mirrorDocumentContent: MirrorDocumentContent[] = [];
  mirrorExtensionActivity: Array<Record<string, unknown>> = [];
  failVoiceProfilesUpsert = false;

  constructor(seed?: {
    documents?: MirrorDocument[];
    contents?: MirrorDocumentContent[];
    chambers?: VoiceChamberRow[];
  }) {
    this.mirrorDocuments = seed?.documents ? [...seed.documents] : [];
    this.mirrorDocumentContent = seed?.contents ? [...seed.contents] : [];
    for (const row of seed?.chambers || []) {
      this.voiceChambers.set(`${row.user_id}:${row.chamber}`, row);
    }
  }

  from(table: string) {
    if (table === "voice_profiles") {
      const self = this;
      let userId = "";
      return {
        select() {
          const query = {
            eq(column: string, value: string) {
              if (column === "user_id") userId = value;
              return query;
            },
            async maybeSingle() {
              return { data: self.voiceProfiles.get(userId) || null, error: null };
            },
            async single() {
              const data = self.voiceProfiles.get(userId) || null;
              return { data, error: data ? null : { message: "not found" } };
            },
          };
          return query;
        },
        async upsert(value: Record<string, unknown>) {
          if (self.failVoiceProfilesUpsert) {
            return { error: { message: "cache offline" } };
          }
          self.voiceProfiles.set(String(value.user_id), value);
          return { error: null };
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
        async upsert(value: Record<string, unknown>) {
          self.voiceChambers.set(`${value.user_id}:${value.chamber}`, value as unknown as VoiceChamberRow);
          return { error: null };
        },
        delete() {
          return {
            eq(column: string, value: string) {
              if (column !== "user_id") throw new Error("unexpected delete column");
              for (const key of Array.from(self.voiceChambers.keys())) {
                if (key.startsWith(`${value}:`)) self.voiceChambers.delete(key);
              }
              return Promise.resolve({ error: null });
            },
          };
        },
        async insert(rows: VoiceChamberRow[]) {
          for (const row of rows) {
            self.voiceChambers.set(`${row.user_id}:${row.chamber}`, row);
          }
          return { error: null };
        },
      };
    }

    if (table === "mirror_extension_activity") {
      const self = this;
      return {
        async insert(value: Record<string, unknown>) {
          self.mirrorExtensionActivity.push(value);
          return { error: null };
        },
      };
    }

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
              const row = self.mirrorDocuments.find((doc) =>
                filters.every((filter) => (doc as Record<string, unknown>)[filter.column] === filter.value)
              );
              return { data: row || null, error: null };
            },
            then(
              resolve: (value: { data: MirrorDocument[]; error: null }) => unknown,
              reject?: (reason?: unknown) => unknown
            ) {
              const data = self.mirrorDocuments.filter((doc) =>
                filters.every((filter) => (doc as Record<string, unknown>)[filter.column] === filter.value)
              );
              return Promise.resolve({ data, error: null }).then(resolve, reject);
            },
          };
          return query;
        },
        update(values: Record<string, unknown>) {
          return {
            eq(column: string, value: string) {
              filters.push({ column, value });
              const updateQuery = {
                eq(nextColumn: string, nextValue: string) {
                  filters.push({ column: nextColumn, value: nextValue });
                  return updateQuery;
                },
                then(
                  resolve: (value: { error: null }) => unknown,
                  reject?: (reason?: unknown) => unknown
                ) {
                  for (const doc of self.mirrorDocuments) {
                    if (
                      filters.every(
                        (filter) => (doc as Record<string, unknown>)[filter.column] === filter.value
                      )
                    ) {
                      Object.assign(doc, values);
                    }
                  }
                  return Promise.resolve({ error: null }).then(resolve, reject);
                },
              };
              return updateQuery;
            },
          };
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
                data: self.mirrorDocumentContent.filter((row) => ids.includes(row.document_id)),
                error: null,
              });
            },
          };
        },
      };
    }

    throw new Error(`Unexpected table ${table}`);
  }
}

function withIntegritySupabase<T>(supabase: IntegritySupabase, fn: () => Promise<T>) {
  return fn();
}

test.describe("mirror-mode chamber integrity", () => {
  test("learning write to specific chamber updates overall aggregate", async () => {
    const supabase = new IntegritySupabase();

    const result = await withIntegritySupabase(supabase, async () =>
      ingestExtensionFingerprint({
        supabase: supabase as unknown as SupabaseClient,
        userId: "user-1",
        fingerprint: buildFingerprint("academic"),
        hostname: "docs.google.com",
      })
    );

    expect(result.captured).toBe(true);
    expect(result.chamber).toBe("academic");
    expect(supabase.voiceChambers.has("user-1:academic")).toBe(true);
    expect(supabase.voiceChambers.has("user-1:overall")).toBe(true);
    expect(supabase.voiceChambers.get("user-1:academic")?.document_count).toBe(1);
    expect(supabase.voiceChambers.get("user-1:overall")?.document_count).toBe(1);
  });

  test("reclassifying document recalculates both affected chambers", async () => {
    const supabase = new IntegritySupabase({
      documents: [
        {
          id: "doc-career",
          user_id: "user-1",
          file_name: "Career sample",
          writing_type: "professional",
          word_count: 120,
          training_allowed: true,
          excluded_from_profile: false,
          visibility_status: "active",
          deleted_at: null,
          created_at: "2026-03-22T12:00:00.000Z",
        },
        {
          id: "doc-academic",
          user_id: "user-1",
          file_name: "Academic sample",
          writing_type: "academic",
          word_count: 120,
          training_allowed: true,
          excluded_from_profile: false,
          visibility_status: "active",
          deleted_at: null,
          created_at: "2026-03-22T12:00:00.000Z",
        },
      ],
      contents: [
        { document_id: "doc-career", extracted_text: "career ".repeat(120) },
        { document_id: "doc-academic", extracted_text: "academic ".repeat(120) },
      ],
    });

    const request = new NextRequest("http://localhost:3000/api/mirror/documents/doc-career/reclassify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ new_chamber: "academic" }),
    });

    const response = await withIntegritySupabase(supabase, async () =>
      handleReclassifyDocument(
        request,
        { id: "doc-career" },
        {
          resolveUserId: async () => "user-1",
          createSupabaseAdmin: () => supabase as unknown as SupabaseClient,
        }
      )
    );

    expect(response.status).toBe(200);
    expect(supabase.mirrorDocuments.find((doc) => doc.id === "doc-career")?.writing_type).toBe("academic");
    expect(supabase.voiceChambers.has("user-1:career")).toBe(false);
    expect(supabase.voiceChambers.get("user-1:academic")?.document_count).toBe(2);
    expect(supabase.voiceChambers.get("user-1:overall")?.document_count).toBe(2);
  });

  test("voice_profiles cache failure does not fail the learning request", async () => {
    const supabase = new IntegritySupabase();
    supabase.failVoiceProfilesUpsert = true;

    const result = await withIntegritySupabase(supabase, async () =>
      ingestExtensionFingerprint({
        supabase: supabase as unknown as SupabaseClient,
        userId: "user-1",
        fingerprint: buildFingerprint("creative"),
        hostname: "medium.com",
      })
    );

    expect(result.captured).toBe(true);
    expect(result.chamber).toBe("creative");
    expect(supabase.voiceChambers.has("user-1:creative")).toBe(true);
    expect(supabase.voiceChambers.has("user-1:overall")).toBe(true);
    expect(supabase.voiceProfiles.size).toBe(0);
  });
});
