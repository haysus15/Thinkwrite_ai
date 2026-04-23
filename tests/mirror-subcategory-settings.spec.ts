import { expect, test, type Page, type Route } from "playwright/test";
import { NextRequest } from "next/server.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  handleDeleteSubcategory,
  handlePatchSubcategory,
  handlePostSubcategories,
} from "@/app/api/mirror/subcategories/handler";
import type { ContextMemoryEntry, Subcategory } from "@/lib/mirror-mode/subcategoryService";

class SubcategoryApiSupabase {
  subcategories = new Map<string, Subcategory>();
  contextEntries = new Map<string, ContextMemoryEntry>();
  sequence = 1;

  from(table: string) {
    if (table === "mirror_subcategories") {
      return this.subcategoryTable();
    }
    if (table === "mirror_context_memory") {
      return this.contextTable();
    }
    throw new Error(`Unexpected table ${table}`);
  }

  private subcategoryTable() {
    const self = this;
    let filters: Array<{ column: string; value: string }> = [];

    const applyFilters = () =>
      Array.from(self.subcategories.values()).filter((row) =>
        filters.every(
          (filter) =>
            String((row as unknown as Record<string, unknown>)[filter.column]) === filter.value
        )
      );

    return {
      select() {
        const query = {
          eq(column: string, value: string) {
            filters.push({ column, value });
            return query;
          },
          async maybeSingle() {
            return { data: applyFilters()[0] || null, error: null };
          },
          async single() {
            return { data: applyFilters()[0] || null, error: null };
          },
        };
        return query;
      },
      insert(payload: Record<string, unknown>) {
        return {
          select() {
            return {
              async single() {
                const id = `subcategory-${self.sequence++}`;
                const now = new Date().toISOString();
                const row: Subcategory = {
                  id,
                  user_id: String(payload.user_id),
                  name: String(payload.name),
                  parent_chamber: payload.parent_chamber as Subcategory["parent_chamber"],
                  aggregate_fingerprint: {},
                  confidence_level: 0,
                  document_count: 0,
                  total_word_count: 0,
                  last_trained_at: null,
                  evolution_history: [],
                  created_at: now,
                  updated_at: now,
                };
                self.subcategories.set(id, row);
                return { data: row, error: null };
              },
            };
          },
        };
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
              select() {
                return {
                  async single() {
                    const row = applyFilters()[0];
                    if (!row) {
                      return { data: null, error: null };
                    }
                    Object.assign(row, values);
                    return { data: row, error: null };
                  },
                };
              },
            };
            return query;
          },
        };
      },
      delete() {
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
                for (const row of applyFilters()) {
                  self.subcategories.delete(row.id);
                  for (const [contextId, entry] of self.contextEntries.entries()) {
                    if (entry.subcategory_id === row.id) {
                      self.contextEntries.delete(contextId);
                    }
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

  private contextTable() {
    const self = this;
    return {
      select() {
        const query = {
          eq() {
            return query;
          },
          async maybeSingle() {
            return { data: null, error: null };
          },
        };
        return query;
      },
    };
  }
}

function seedSubcategory(
  supabase: SubcategoryApiSupabase,
  overrides?: Partial<Subcategory>
): Subcategory {
  const row: Subcategory = {
    id: `subcategory-seed-${supabase.sequence++}`,
    user_id: "user-1",
    name: "Manager Emails",
    parent_chamber: "career",
    aggregate_fingerprint: {},
    confidence_level: 0.52,
    document_count: 4,
    total_word_count: 1600,
    last_trained_at: "2026-03-26T12:00:00.000Z",
    evolution_history: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
  supabase.subcategories.set(row.id, row);
  return row;
}

function seedContext(
  supabase: SubcategoryApiSupabase,
  subcategoryId: string
): ContextMemoryEntry {
  const row: ContextMemoryEntry = {
    id: `context-${supabase.sequence++}`,
    user_id: "user-1",
    subcategory_id: subcategoryId,
    entity_type: "person",
    entity_name: "Sarah",
    attributes: { role: "Manager" },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  supabase.contextEntries.set(row.id, row);
  return row;
}

async function enableE2EAuth(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("e2e-auth", "1");
  });
}

const baseConsent = {
  career: { consented: false, consented_at: null },
  academic: { consented: false, consented_at: null },
  creative: { consented: false, consented_at: null },
  general: { consented: false, consented_at: null },
};

const baseDashboard = {
  success: true,
  chambers: {
    career: {
      confidenceLevel: 0.6,
      confidenceLabel: "Developing",
      documentCount: 4,
      totalWordCount: 4200,
      lastTrainedAt: "2026-03-22T12:00:00.000Z",
      updatedAt: "2026-03-22T12:00:00.000Z",
    },
    academic: {
      confidenceLevel: 0.74,
      confidenceLabel: "Strong",
      documentCount: 5,
      totalWordCount: 6200,
      lastTrainedAt: "2026-03-22T12:00:00.000Z",
      updatedAt: "2026-03-22T12:00:00.000Z",
    },
    creative: {
      confidenceLevel: 0.42,
      confidenceLabel: "Emerging",
      documentCount: 2,
      totalWordCount: 2300,
      lastTrainedAt: "2026-03-22T12:00:00.000Z",
      updatedAt: "2026-03-22T12:00:00.000Z",
    },
    general: {
      confidenceLevel: 0.55,
      confidenceLabel: "Developing",
      documentCount: 1,
      totalWordCount: 900,
      lastTrainedAt: "2026-03-22T12:00:00.000Z",
      updatedAt: "2026-03-22T12:00:00.000Z",
    },
    overall: {
      confidenceLevel: 0.82,
      confidenceLabel: "Strong",
      documentCount: 12,
      totalWordCount: 18400,
      lastTrainedAt: "2026-03-22T12:00:00.000Z",
      updatedAt: "2026-03-22T12:00:00.000Z",
    },
  },
  queueCount: 0,
};

async function fulfillSettingsBootstrap(route: Route) {
  const url = route.request().url();
  const method = route.request().method();
  if (method === "GET" && url.endsWith("/api/mirror/consent")) {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, consent: baseConsent }),
    });
    return true;
  }
  if (method === "GET" && url.endsWith("/api/mirror/domain-rules")) {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, rules: [] }),
    });
    return true;
  }
  if (method === "GET" && url.endsWith("/api/mirror/unclassified")) {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, items: [] }),
    });
    return true;
  }
  if (method === "GET" && url.endsWith("/api/mirror/dashboard")) {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(baseDashboard),
    });
    return true;
  }
  if (method === "GET" && url.endsWith("/api/mirror/context-memory")) {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ subcategories: [] }),
    });
    return true;
  }
  return false;
}

test.describe("mirror subcategory settings", () => {
  test("POST /api/mirror/subcategories creates subcategory correctly", async () => {
    const supabase = new SubcategoryApiSupabase();
    const response = await handlePostSubcategories(
      new NextRequest("http://localhost/api/mirror/subcategories", {
        method: "POST",
        body: JSON.stringify({ name: "Thesis Writing", parent_chamber: "academic" }),
      }),
      {
        resolveUserId: async () => "user-1",
        createSupabaseAdmin: () => supabase as unknown as SupabaseClient,
      }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      subcategory: { name: "Thesis Writing", parent_chamber: "academic" },
    });
  });

  test("POST /api/mirror/subcategories returns existing record for duplicate name under same chamber", async () => {
    const supabase = new SubcategoryApiSupabase();
    const existing = seedSubcategory(supabase, { name: "Manager Emails", parent_chamber: "career" });
    const response = await handlePostSubcategories(
      new NextRequest("http://localhost/api/mirror/subcategories", {
        method: "POST",
        body: JSON.stringify({ name: "Manager Emails", parent_chamber: "career" }),
      }),
      {
        resolveUserId: async () => "user-1",
        createSupabaseAdmin: () => supabase as unknown as SupabaseClient,
      }
    );

    await expect(response.json()).resolves.toMatchObject({
      success: true,
      subcategory: { id: existing.id, name: existing.name },
    });
  });

  test("PATCH /api/mirror/subcategories/:id renames correctly", async () => {
    const supabase = new SubcategoryApiSupabase();
    const subcategory = seedSubcategory(supabase);
    const response = await handlePatchSubcategory(
      new NextRequest(`http://localhost/api/mirror/subcategories/${subcategory.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: "Leadership Notes" }),
      }),
      { id: subcategory.id },
      {
        resolveUserId: async () => "user-1",
        createSupabaseAdmin: () => supabase as unknown as SupabaseClient,
      }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      subcategory: { id: subcategory.id, name: "Leadership Notes" },
    });
  });

  test("PATCH /api/mirror/subcategories/:id rejects rename when name already exists under same chamber", async () => {
    const supabase = new SubcategoryApiSupabase();
    const first = seedSubcategory(supabase, { id: "sub-1", name: "Manager Emails" });
    seedSubcategory(supabase, { id: "sub-2", name: "Leadership Notes" });

    const response = await handlePatchSubcategory(
      new NextRequest(`http://localhost/api/mirror/subcategories/${first.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: "Leadership Notes" }),
      }),
      { id: first.id },
      {
        resolveUserId: async () => "user-1",
        createSupabaseAdmin: () => supabase as unknown as SupabaseClient,
      }
    );

    expect(response.status).toBe(409);
  });

  test("PATCH /api/mirror/subcategories/:id rejects when userId does not match", async () => {
    const supabase = new SubcategoryApiSupabase();
    const subcategory = seedSubcategory(supabase, { user_id: "user-2" });

    const response = await handlePatchSubcategory(
      new NextRequest(`http://localhost/api/mirror/subcategories/${subcategory.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: "Leadership Notes" }),
      }),
      { id: subcategory.id },
      {
        resolveUserId: async () => "user-1",
        createSupabaseAdmin: () => supabase as unknown as SupabaseClient,
      }
    );

    expect(response.status).toBe(404);
  });

  test("DELETE /api/mirror/subcategories/:id removes subcategory", async () => {
    const supabase = new SubcategoryApiSupabase();
    const subcategory = seedSubcategory(supabase);
    seedContext(supabase, subcategory.id);

    const response = await handleDeleteSubcategory(
      new NextRequest(`http://localhost/api/mirror/subcategories/${subcategory.id}`, {
        method: "DELETE",
      }),
      { id: subcategory.id },
      {
        resolveUserId: async () => "user-1",
        createSupabaseAdmin: () => supabase as unknown as SupabaseClient,
      }
    );

    expect(response.status).toBe(200);
    expect(supabase.subcategories.has(subcategory.id)).toBe(false);
    expect(Array.from(supabase.contextEntries.values())).toHaveLength(0);
  });

  test("DELETE /api/mirror/subcategories/:id rejects when userId does not match", async () => {
    const supabase = new SubcategoryApiSupabase();
    const subcategory = seedSubcategory(supabase, { user_id: "user-2" });

    const response = await handleDeleteSubcategory(
      new NextRequest(`http://localhost/api/mirror/subcategories/${subcategory.id}`, {
        method: "DELETE",
      }),
      { id: subcategory.id },
      {
        resolveUserId: async () => "user-1",
        createSupabaseAdmin: () => supabase as unknown as SupabaseClient,
      }
    );

    expect(response.status).toBe(404);
  });

  test("Voice Contexts section renders in settings UI", async ({ page }) => {
    await enableE2EAuth(page);
    await page.route("**/api/mirror/**", async (route) => {
      if (await fulfillSettingsBootstrap(route)) return;
      const url = route.request().url();
      if (route.request().method() === "GET" && url.endsWith("/api/mirror/subcategories?chamber=career")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            subcategories: [seedSubcategory(new SubcategoryApiSupabase(), { id: "sub-ui-1" })],
          }),
        });
        return;
      }
      if (route.request().method() === "GET" && url.includes("/api/mirror/subcategories?chamber=")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, subcategories: [] }),
        });
        return;
      }
      await route.abort();
    });

    await page.goto("/mirror/settings");

    await expect(page.getByText("8. Voice Contexts")).toBeVisible();
    await expect(page.getByTestId("add-voice-context")).toBeVisible();
  });

  test("Delete requires typed confirmation matching subcategory name", async ({ page }) => {
    await enableE2EAuth(page);
    let deleteCalled = false;

    await page.route("**/api/mirror/**", async (route) => {
      if (await fulfillSettingsBootstrap(route)) return;
      const url = route.request().url();
      if (route.request().method() === "GET" && url.endsWith("/api/mirror/subcategories?chamber=career")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            subcategories: [
              {
                id: "sub-1",
                user_id: "user-1",
                name: "Manager Emails",
                parent_chamber: "career",
                confidence_level: 0.5,
                document_count: 4,
                total_word_count: 1200,
                last_trained_at: "2026-03-26T12:00:00.000Z",
              },
            ],
          }),
        });
        return;
      }
      if (route.request().method() === "GET" && url.includes("/api/mirror/subcategories?chamber=")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, subcategories: [] }),
        });
        return;
      }
      if (route.request().method() === "DELETE" && url.endsWith("/api/mirror/subcategories/sub-1")) {
        deleteCalled = true;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true }),
        });
        return;
      }
      await route.abort();
    });

    await page.goto("/mirror/settings");
    await page.getByTestId("delete-subcategory-sub-1").click();
    const confirmButton = page.getByTestId("delete-subcategory-confirm-sub-1");
    await expect(confirmButton).toBeDisabled();
    await page.getByTestId("delete-subcategory-confirmation-sub-1").fill("Manager Emails");
    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();

    expect(deleteCalled).toBe(true);
  });

  test("Rename saves correctly inline", async ({ page }) => {
    await enableE2EAuth(page);
    let renameBody: Record<string, unknown> | null = null;

    await page.route("**/api/mirror/**", async (route) => {
      if (await fulfillSettingsBootstrap(route)) return;
      const url = route.request().url();
      if (route.request().method() === "GET" && url.endsWith("/api/mirror/subcategories?chamber=career")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            subcategories: [
              {
                id: "sub-1",
                user_id: "user-1",
                name: "Manager Emails",
                parent_chamber: "career",
                confidence_level: 0.5,
                document_count: 4,
                total_word_count: 1200,
                last_trained_at: "2026-03-26T12:00:00.000Z",
              },
            ],
          }),
        });
        return;
      }
      if (route.request().method() === "GET" && url.includes("/api/mirror/subcategories?chamber=")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, subcategories: [] }),
        });
        return;
      }
      if (route.request().method() === "PATCH" && url.endsWith("/api/mirror/subcategories/sub-1")) {
        renameBody = route.request().postDataJSON() as Record<string, unknown>;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            subcategory: {
              id: "sub-1",
              user_id: "user-1",
              name: "Leadership Notes",
              parent_chamber: "career",
              confidence_level: 0.5,
              document_count: 4,
              total_word_count: 1200,
              last_trained_at: "2026-03-26T12:00:00.000Z",
            },
          }),
        });
        return;
      }
      await route.abort();
    });

    await page.goto("/mirror/settings");
    await page.getByTestId("rename-subcategory-sub-1").click();
    await page.getByTestId("rename-subcategory-input-sub-1").fill("Leadership Notes");
    await page.getByTestId("rename-subcategory-save-sub-1").click();

    expect(renameBody).toEqual({ name: "Leadership Notes" });
    await expect(page.getByText("Leadership Notes")).toBeVisible();
  });
});
