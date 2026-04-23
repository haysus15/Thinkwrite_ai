import { expect, test } from "playwright/test";
import { NextRequest } from "next/server.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  handleGetDomainRules,
  handlePostDomainRule,
} from "@/app/api/mirror/domain-rules/handler";
import { handleDeleteDomainRule } from "@/app/api/mirror/domain-rules/[id]/handler";
import { handleClassifyUnclassified } from "@/app/api/mirror/unclassified/handler";
import { handleReclassifyDocument } from "@/app/api/mirror/documents/[id]/reclassify/handler";
import { handleExtensionFingerprintPost } from "@/app/api/mirror-mode/extension/fingerprint/handler";
import type { ExtensionFingerprint } from "@/lib/mirror-core/extension/ingestion";

function buildJsonRequest(url: string, body: unknown) {
  return new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-extension-hostname": "docs.google.com" },
    body: JSON.stringify(body),
  });
}

function createFingerprint(chamber: ExtensionFingerprint["chamber"] = "general"): ExtensionFingerprint {
  return {
    sessionId: "session-1",
    chamber,
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
  };
}

test.describe("mirror-mode classification APIs", () => {
  test("domain rule creation succeeds", async () => {
    let insertedDomain: string | null = null;
    const response = await handlePostDomainRule(
      buildJsonRequest("http://localhost:3000/api/mirror/domain-rules", {
        domain: "docs.google.com",
        target_chamber: "academic",
      }),
      {
        resolveUserId: async () => "user-1",
        createSupabaseAdmin: () =>
          ({
            from(table: string) {
              expect(table).toBe("mirror_domain_rules");
              return {
                select() {
                  return {
                    eq(_column: string, _value: string) {
                      return {
                        eq(_column2: string, _value2: string) {
                          return {
                            async maybeSingle() {
                              return { data: null };
                            },
                          };
                        },
                      };
                    },
                  };
                },
                upsert(values: Record<string, unknown>) {
                  insertedDomain = String(values.domain);
                  return {
                    select() {
                      return {
                        async single() {
                          return {
                            data: {
                              id: "rule-1",
                              domain: values.domain,
                              target_chamber: values.target_chamber,
                              created_at: "2026-03-22T00:00:00.000Z",
                              updated_at: "2026-03-22T00:00:00.000Z",
                            },
                            error: null,
                          };
                        },
                      };
                    },
                  };
                },
              };
            },
          }) as unknown as SupabaseClient,
      }
    );

    expect(insertedDomain).toBe("docs.google.com");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      rule: { domain: "docs.google.com", target_chamber: "academic" },
    });
  });

  test("duplicate domain rule returns 409", async () => {
    const response = await handlePostDomainRule(
      buildJsonRequest("http://localhost:3000/api/mirror/domain-rules", {
        domain: "docs.google.com",
        target_chamber: "academic",
      }),
      {
        resolveUserId: async () => "user-1",
        createSupabaseAdmin: () =>
          ({
            from() {
              return {
                select() {
                  return {
                    eq() {
                      return {
                        eq() {
                          return {
                            async maybeSingle() {
                              return { data: { id: "rule-1", target_chamber: "academic" } };
                            },
                          };
                        },
                      };
                    },
                  };
                },
              };
            },
          }) as unknown as SupabaseClient,
      }
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: "domain_rule_exists",
    });
  });

  test("domain rule deletion works", async () => {
    let deletedId: string | null = null;
    const response = await handleDeleteDomainRule(
      new NextRequest("http://localhost:3000/api/mirror/domain-rules/rule-1", {
        method: "DELETE",
      }),
      { id: "rule-1" },
      {
        resolveUserId: async () => "user-1",
        createSupabaseAdmin: () =>
          ({
            from() {
              return {
                delete() {
                  return {
                    eq(column: string, value: string) {
                      if (column === "id") deletedId = value;
                      return {
                        async eq() {
                          return { error: null };
                        },
                      };
                    },
                  };
                },
              };
            },
          }) as unknown as SupabaseClient,
      }
    );

    expect(deletedId).toBe("rule-1");
    expect(response.status).toBe(200);
  });

  test("capture with matching domain rule routes to correct chamber", async () => {
    let ingestedChamber: string | null = null;
    const response = await handleExtensionFingerprintPost(
      buildJsonRequest(
        "http://localhost:3000/api/mirror-mode/extension/fingerprint",
        createFingerprint("general")
      ),
      {
        resolveUserId: async () => "user-1",
        createSupabaseAdmin: () =>
          ({
            from(table: string) {
              if (table === "mirror_domain_rules") {
                return {
                  select() {
                    return {
                      eq() {
                        return {
                          eq() {
                            return {
                              async maybeSingle() {
                                return {
                                  data: { id: "rule-1", target_chamber: "academic" },
                                };
                              },
                            };
                          },
                        };
                      },
                    };
                  },
                };
              }
              if (table === "mirror_mode_consent") {
                return {
                  select() {
                    return {
                      eq() {
                        return {
                          eq() {
                            return {
                              async maybeSingle() {
                                return { data: { id: "consent-1" } };
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
          }) as unknown as SupabaseClient,
        ingestExtensionFingerprint: async ({ fingerprint }) => {
          ingestedChamber = fingerprint.chamber;
          return {
            captured: true,
            chamber: fingerprint.chamber,
            confidenceLevel: 0.7,
            confidenceLabel: "strong",
          };
        },
      }
    );

    expect(response.status).toBe(200);
    expect(ingestedChamber).toBe("academic");
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      chamber: "academic",
      queued: false,
    });
  });

  test("capture with no domain rule routes to general and creates queue entry", async () => {
    let queuedDomain: string | null = null;
    const response = await handleExtensionFingerprintPost(
      buildJsonRequest(
        "http://localhost:3000/api/mirror-mode/extension/fingerprint",
        createFingerprint("general")
      ),
      {
        resolveUserId: async () => "user-1",
        createSupabaseAdmin: () =>
          ({
            from(table: string) {
              if (table === "mirror_domain_rules") {
                return {
                  select() {
                    return {
                      eq() {
                        return {
                          eq() {
                            return {
                              async maybeSingle() {
                                return { data: null };
                              },
                            };
                          },
                        };
                      },
                    };
                  },
                };
              }
              if (table === "mirror_mode_consent") {
                return {
                  select() {
                    return {
                      eq() {
                        return {
                          eq() {
                            return {
                              async maybeSingle() {
                                return { data: { id: "consent-1" } };
                              },
                            };
                          },
                        };
                      },
                    };
                  },
                };
              }
              if (table === "mirror_unclassified_queue") {
                return {
                  async insert(values: Record<string, unknown>) {
                    queuedDomain = String(values.source_domain);
                    return { error: null };
                  },
                };
              }
              throw new Error(`Unexpected table ${table}`);
            },
          }) as unknown as SupabaseClient,
        ingestExtensionFingerprint: async () => {
          throw new Error("should not ingest when unclassified");
        },
      }
    );

    expect(response.status).toBe(200);
    expect(queuedDomain).toBe("docs.google.com");
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      chamber: "general",
      queued: true,
    });
  });

  test("classifying queue item updates voice_chambers correctly", async () => {
    let chamberUpserted = false;
    const response = await handleClassifyUnclassified(
      buildJsonRequest("http://localhost:3000/api/mirror/unclassified/item-1/classify", {
        chamber: "career",
        create_domain_rule: false,
      }),
      { id: "item-1" },
      {
        resolveUserId: async () => "user-1",
        createSupabaseAdmin: () =>
          ({
            from(table: string) {
              if (table === "mirror_unclassified_queue") {
                return {
                  select() {
                    return {
                      eq() {
                        return {
                          eq() {
                            return {
                              async maybeSingle() {
                                return {
                                  data: {
                                    id: "item-1",
                                    source_domain: "docs.google.com",
                                    capture_source: "extension",
                                    fingerprint_data: createFingerprint("general"),
                                    word_count: 120,
                                    captured_at: new Date().toISOString(),
                                    reviewed: false,
                                    assigned_chamber: null,
                                    assigned_at: null,
                                  },
                                  error: null,
                                };
                              },
                            };
                          },
                          async order() {
                            return { data: [], error: null };
                          },
                        };
                      },
                    };
                  },
                  update() {
                    return {
                      eq() {
                        return {
                          async eq() {
                            return { error: null };
                          },
                        };
                      },
                    };
                  },
                };
              }
              if (table === "voice_chambers") {
                return {
                  select() {
                    return {
                      eq() {
                        return {
                          eq() {
                            return {
                              async maybeSingle() {
                                return { data: null, error: null };
                              },
                            };
                          },
                        };
                      },
                    };
                  },
                  async upsert() {
                    chamberUpserted = true;
                    return { error: null };
                  },
                };
              }
              if (table === "voice_profiles") {
                return {
                  select() {
                    return {
                      eq() {
                        return {
                          async maybeSingle() {
                            return { data: null, error: null };
                          },
                        };
                      },
                    };
                  },
                  async upsert() {
                    return { error: null };
                  },
                };
              }
              if (table === "mirror_extension_activity") {
                return {
                  async insert() {
                    return { error: null };
                  },
                };
              }
              if (table === "mirror_domain_rules") {
                return {
                  async upsert() {
                    return { error: null };
                  },
                };
              }
              throw new Error(`Unexpected table ${table}`);
            },
          }) as unknown as SupabaseClient,
      }
    );

    expect(response.status).toBe(200);
    expect(chamberUpserted).toBeTruthy();
  });

  test("creating domain rule from classification works", async () => {
    let ruleCreated = false;
    const response = await handleClassifyUnclassified(
      buildJsonRequest("http://localhost:3000/api/mirror/unclassified/item-1/classify", {
        chamber: "academic",
        create_domain_rule: true,
      }),
      { id: "item-1" },
      {
        resolveUserId: async () => "user-1",
        createSupabaseAdmin: () =>
          ({
            from(table: string) {
              if (table === "mirror_unclassified_queue") {
                return {
                  select() {
                    return {
                      eq() {
                        return {
                          eq() {
                            return {
                              async maybeSingle() {
                                return {
                                  data: {
                                    id: "item-1",
                                    source_domain: "docs.google.com",
                                    capture_source: "extension",
                                    fingerprint_data: createFingerprint("general"),
                                    word_count: 120,
                                    captured_at: new Date().toISOString(),
                                    reviewed: false,
                                    assigned_chamber: null,
                                    assigned_at: null,
                                  },
                                  error: null,
                                };
                              },
                            };
                          },
                          async order() {
                            return { data: [], error: null };
                          },
                        };
                      },
                    };
                  },
                  update() {
                    return {
                      eq() {
                        return {
                          async eq() {
                            return { error: null };
                          },
                        };
                      },
                    };
                  },
                };
              }
              if (table === "mirror_domain_rules") {
                return {
                  async upsert() {
                    ruleCreated = true;
                    return { error: null };
                  },
                };
              }
              if (table === "voice_chambers") {
                return {
                  select() {
                    return {
                      eq() {
                        return {
                          eq() {
                            return {
                              async maybeSingle() {
                                return { data: null, error: null };
                              },
                            };
                          },
                        };
                      },
                    };
                  },
                  async upsert() {
                    return { error: null };
                  },
                };
              }
              if (table === "voice_profiles") {
                return {
                  select() {
                    return {
                      eq() {
                        return {
                          async maybeSingle() {
                            return { data: null, error: null };
                          },
                        };
                      },
                    };
                  },
                  async upsert() {
                    return { error: null };
                  },
                };
              }
              if (table === "mirror_extension_activity") {
                return {
                  async insert() {
                    return { error: null };
                  },
                };
              }
              throw new Error(`Unexpected table ${table}`);
            },
          }) as unknown as SupabaseClient,
      }
    );

    expect(response.status).toBe(200);
    expect(ruleCreated).toBeTruthy();
  });

  test("reclassification updates both affected chambers", async () => {
    let deletedChambers = false;
    let insertedRows = 0;
    const response = await handleReclassifyDocument(
      buildJsonRequest("http://localhost:3000/api/mirror/documents/doc-1/reclassify", {
        new_chamber: "creative",
      }),
      { id: "doc-1" },
      {
        resolveUserId: async () => "user-1",
        createSupabaseAdmin: () =>
          ({
            from(table: string) {
              if (table === "mirror_documents") {
                return {
                  select() {
                    return {
                      eq(column: string, value: string) {
                        if (column === "id" && value === "doc-1") {
                          return {
                            async maybeSingle() {
                              return {
                                data: {
                                  id: "doc-1",
                                  user_id: "user-1",
                                  writing_type: "professional",
                                },
                                error: null,
                              };
                            },
                          };
                        }
                        return {
                          eq() {
                            return Promise.resolve({
                              data: [
                                {
                                  id: "doc-1",
                                  file_name: "Doc 1",
                                  writing_type: "creative",
                                  word_count: 20,
                                  training_allowed: true,
                                  deleted_at: null,
                                  visibility_status: "visible",
                                  created_at: new Date().toISOString(),
                                },
                              ],
                              error: null,
                            });
                          },
                          async maybeSingle() {
                            return { data: null, error: null };
                          },
                        };
                      },
                    };
                  },
                  update() {
                    return {
                      eq() {
                        return {
                          async eq() {
                            return { error: null };
                          },
                        };
                      },
                    };
                  },
                };
              }
              if (table === "mirror_document_content") {
                return {
                  select() {
                    return {
                      async in() {
                        return {
                          data: [
                            {
                              document_id: "doc-1",
                              extracted_text:
                                "This is a creative sample with enough words to build a fingerprint and rebuild the chamber profile correctly.",
                            },
                          ],
                          error: null,
                        };
                      },
                    };
                  },
                };
              }
              if (table === "voice_chambers") {
                return {
                  delete() {
                    return {
                      async eq() {
                        deletedChambers = true;
                        return { error: null };
                      },
                    };
                  },
                  async insert(values: unknown[]) {
                    insertedRows = values.length;
                    return { error: null };
                  },
                };
              }
              throw new Error(`Unexpected table ${table}`);
            },
          }) as unknown as SupabaseClient,
      }
    );

    expect(response.status).toBe(200);
    expect(deletedChambers).toBeTruthy();
    expect(insertedRows).toBeGreaterThan(0);
  });
});
