import { expect, test } from "playwright/test";
import { NextRequest } from "next/server.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { handleExtensionFingerprintPost } from "@/app/api/mirror-mode/extension/fingerprint/handler";
import { ingestStudioWriting } from "@/lib/mirror-mode/studioIngestion";
import type { ExtensionFingerprint } from "@/lib/mirror-core/extension/ingestion";

function buildFingerprint(chamber: ExtensionFingerprint["chamber"] = "general"): ExtensionFingerprint {
  return {
    sessionId: "session-1",
    chamber,
    sourceType: "extension",
    capturedAt: "2026-03-22T12:00:00.000Z",
    wordCount: 120,
    avgSentenceLength: 12,
    sentenceLengthVariance: 2,
    avgParagraphLength: 4,
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

function buildFingerprintRequest(): NextRequest {
  return new NextRequest("http://localhost:3000/api/mirror-mode/extension/fingerprint", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-extension-hostname": "docs.google.com",
    },
    body: JSON.stringify(buildFingerprint()),
  });
}

function createConsentSupabase(params: {
  domainRuleChamber: ExtensionFingerprint["chamber"] | null;
  consentByStudio: Partial<Record<ExtensionFingerprint["chamber"], boolean>>;
}) {
  const queueInserts: Array<Record<string, unknown>> = [];

  return {
    queueInserts,
    client: {
      from(table: string) {
        if (table === "mirror_domain_rules") {
          let domain: string | null = null;
          return {
            select() {
              const query: {
                eq: (column: string, value: string) => typeof query;
                maybeSingle: () => Promise<{
                  data: { id: string; target_chamber: ExtensionFingerprint["chamber"] } | null;
                }>;
              } = {
                eq() {
                  return query;
                },
                async maybeSingle() {
                  return {
                    data:
                      domain === "docs.google.com" && params.domainRuleChamber
                        ? { id: "rule-1", target_chamber: params.domainRuleChamber }
                        : null,
                  };
                },
              };
              query.eq = (column: string, value: string) => {
                if (column === "domain") {
                  domain = value;
                }
                return query;
              };
              return query;
            },
          };
        }

        if (table === "mirror_mode_consent") {
          let studio: string | null = null;
          return {
            select() {
              const query: {
                eq: (column: string, value: string) => typeof query;
                maybeSingle: () => Promise<{ data: { id: string } | null }>;
              } = {
                eq(column: string, value: string) {
                  if (column === "studio") {
                    studio = value;
                  }
                  return query;
                },
                async maybeSingle() {
                  return {
                    data: studio && params.consentByStudio[studio as ExtensionFingerprint["chamber"]]
                      ? { id: `consent-${studio}` }
                      : null,
                  };
                },
              };
              return query;
            },
          };
        }

        if (table === "mirror_unclassified_queue") {
          return {
            async insert(payload: Record<string, unknown>) {
              queueInserts.push(payload);
              return { error: null };
            },
          };
        }

        throw new Error(`Unexpected table ${table}`);
      },
    } as unknown as SupabaseClient,
  };
}

function createStudioSupabase(hasConsent: boolean) {
  return {
    from(table: string) {
      if (table === "mirror_mode_consent") {
        return {
          select() {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      async maybeSingle() {
                        return { data: hasConsent ? { id: "consent-academic" } : null };
                      },
                    };
                  },
                };
              },
            };
          },
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  } as unknown as SupabaseClient;
}

test.describe("mirror-mode consent gating", () => {
  test("extension capture rejected when no consent for target chamber", async () => {
    const supabase = createConsentSupabase({
      domainRuleChamber: "academic",
      consentByStudio: {},
    });

    let ingestCalled = false;
    const response = await handleExtensionFingerprintPost(buildFingerprintRequest(), {
      resolveUserId: async () => "user-1",
      createSupabaseAdmin: () => supabase.client,
      ingestExtensionFingerprint: async () => {
        ingestCalled = true;
        throw new Error("should not ingest without consent");
      },
    });

    expect(response.status).toBe(403);
    expect(ingestCalled).toBe(false);
    expect(supabase.queueInserts).toEqual([]);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: "consent_required",
    });
  });

  test("extension capture accepted when consent exists", async () => {
    const supabase = createConsentSupabase({
      domainRuleChamber: "academic",
      consentByStudio: { academic: true },
    });

    let ingestedChamber: string | null = null;
    const response = await handleExtensionFingerprintPost(buildFingerprintRequest(), {
      resolveUserId: async () => "user-1",
      createSupabaseAdmin: () => supabase.client,
      ingestExtensionFingerprint: async ({ fingerprint }) => {
        ingestedChamber = fingerprint.chamber;
        return {
          captured: true,
          chamber: fingerprint.chamber,
          confidenceLevel: 0.62,
          confidenceLabel: "Developing",
        };
      },
    });

    expect(response.status).toBe(200);
    expect(ingestedChamber).toBe("academic");
    expect(supabase.queueInserts).toEqual([]);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      captured: true,
      chamber: "academic",
      queued: false,
    });
  });

  test("studio ingestion rejected when no consent", async () => {
    const result = await ingestStudioWriting({
      supabase: createStudioSupabase(false),
      userId: "user-1",
      sourceStudio: "academic",
      sourceAuthority: "user_uploaded",
      text: "word ".repeat(120),
    });

    expect(result).toEqual({
      captured: false,
      archived: false,
      needsConsent: true,
      mirrorDocumentId: null,
      wordCount: 120,
    });
  });

  test("revoking consent stops new captures for that chamber", async () => {
    const withConsent = createConsentSupabase({
      domainRuleChamber: "academic",
      consentByStudio: { academic: true },
    });

    const allowed = await handleExtensionFingerprintPost(buildFingerprintRequest(), {
      resolveUserId: async () => "user-1",
      createSupabaseAdmin: () => withConsent.client,
      ingestExtensionFingerprint: async ({ fingerprint }) => ({
        captured: true,
        chamber: fingerprint.chamber,
        confidenceLevel: 0.62,
        confidenceLabel: "Developing",
      }),
    });
    expect(allowed.status).toBe(200);

    const revoked = createConsentSupabase({
      domainRuleChamber: "academic",
      consentByStudio: {},
    });

    const blocked = await handleExtensionFingerprintPost(buildFingerprintRequest(), {
      resolveUserId: async () => "user-1",
      createSupabaseAdmin: () => revoked.client,
      ingestExtensionFingerprint: async () => {
        throw new Error("ingest should not run after consent is revoked");
      },
    });

    expect(blocked.status).toBe(403);
    await expect(blocked.json()).resolves.toMatchObject({
      error: "consent_required",
    });
  });
});
