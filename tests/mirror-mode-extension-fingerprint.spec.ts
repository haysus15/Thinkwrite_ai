import { expect, test } from "playwright/test";
import { NextRequest } from "next/server.js";
import {
  handleExtensionFingerprintPost,
} from "@/app/api/mirror-mode/extension/fingerprint/handler";

function buildRequest() {
  return new NextRequest("http://localhost:3000/api/mirror-mode/extension/fingerprint", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-extension-hostname": "docs.google.com",
    },
    body: JSON.stringify({
      sessionId: "session-1",
      chamber: "career",
      sourceType: "extension",
      capturedAt: new Date().toISOString(),
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
    }),
  });
}

function createSupabaseWithRouting(consentId: string | null) {
  return {
    from(table: string) {
      if (table === "mirror_domain_rules") {
        return {
          select(columns: string) {
            expect(columns).toBe("id, target_chamber");
            return this;
          },
          eq(column: string, value: string) {
            if (column === "user_id") {
              expect(value).toBe("user-1");
            }
            if (column === "domain") {
              expect(value).toBe("docs.google.com");
            }
            return this;
          },
          async maybeSingle() {
            return { data: null };
          },
        };
      }

      if (table === "mirror_mode_consent") {
        return {
          select(columns: string) {
            expect(columns).toBe("id");
            return this;
          },
          eq(column: string, value: string) {
            if (column === "user_id") {
              expect(value).toBe("user-1");
            }
            if (column === "studio") {
              expect(value).toBe("general");
            }
            return this;
          },
          async maybeSingle() {
            return { data: consentId ? { id: consentId } : null };
          },
        };
      }

      if (table === "mirror_unclassified_queue") {
        return {
          async insert(payload: Record<string, unknown>) {
            expect(payload.user_id).toBe("user-1");
            expect(payload.source_domain).toBe("docs.google.com");
            expect(payload.capture_source).toBe("extension");
            expect(payload.word_count).toBe(120);
            return { error: null };
          },
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };
}

test.describe("mirror-mode extension fingerprint consent gate", () => {
  test("rejects capture with 403 when no general consent exists", async () => {
    const response = await handleExtensionFingerprintPost(buildRequest(), {
      resolveUserId: async () => "user-1",
      createSupabaseAdmin: () => createSupabaseWithRouting(null) as never,
      ingestExtensionFingerprint: async () => {
        throw new Error("ingestion should not run without consent");
      },
    });

    expect(response.status).toBe(403);
  });

  test("returns consent_required body when general consent is missing", async () => {
    const response = await handleExtensionFingerprintPost(buildRequest(), {
      resolveUserId: async () => "user-1",
      createSupabaseAdmin: () => createSupabaseWithRouting(null) as never,
      ingestExtensionFingerprint: async () => {
        throw new Error("ingestion should not run without consent");
      },
    });

    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: "consent_required",
    });
  });

  test("accepts capture when general consent exists", async () => {
    let ingestCalled = false;

    const response = await handleExtensionFingerprintPost(buildRequest(), {
      resolveUserId: async () => "user-1",
      createSupabaseAdmin: () => createSupabaseWithRouting("consent-1") as never,
      ingestExtensionFingerprint: async () => {
        ingestCalled = true;
        throw new Error("ingestion should not run for unrouted general captures");
      },
    });

    expect(response.status).toBe(200);
    expect(ingestCalled).toBe(false);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      captured: true,
      chamber: "general",
      queued: true,
    });
  });
});
