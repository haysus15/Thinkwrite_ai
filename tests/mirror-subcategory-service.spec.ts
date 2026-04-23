import { expect, test } from "playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createSubcategory,
  getInheritanceBlend,
  getSubcategories,
  getSubcategory,
  getSubcategoryWithContextMemory,
  updateSubcategoryFingerprint,
  type ContextMemoryEntry,
  type Json,
  type Subcategory,
} from "@/lib/mirror-mode/subcategoryService";

class FakeSupabase {
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
    let orderBy: { column: string; ascending: boolean } | null = null;

    const applyFilters = () =>
      Array.from(self.subcategories.values()).filter((row) =>
        filters.every(
          (filter) => String((row as unknown as Record<string, unknown>)[filter.column]) === filter.value
        )
      );

    return {
      select() {
        const query = {
          eq(column: string, value: string) {
            filters.push({ column, value });
            return query;
          },
          order(column: string, options?: { ascending?: boolean }) {
            orderBy = { column, ascending: options?.ascending !== false };
            return query;
          },
          async maybeSingle() {
            return { data: applyFilters()[0] || null, error: null };
          },
          async then(
            resolve: (value: { data: Subcategory[]; error: null }) => unknown,
            reject?: (reason?: unknown) => unknown
          ) {
            let rows = applyFilters();
            if (orderBy) {
              rows = [...rows].sort((left, right) => {
                const leftValue = Number((left as unknown as Record<string, unknown>)[orderBy!.column] || 0);
                const rightValue = Number((right as unknown as Record<string, unknown>)[orderBy!.column] || 0);
                return orderBy!.ascending ? leftValue - rightValue : rightValue - leftValue;
              });
            }
            return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
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
                  aggregate_fingerprint: (payload.aggregate_fingerprint as Json) ?? {},
                  confidence_level: Number(payload.confidence_level ?? 0),
                  document_count: Number(payload.document_count ?? 0),
                  total_word_count: Number(payload.total_word_count ?? 0),
                  last_trained_at: (payload.last_trained_at as string | null) ?? null,
                  evolution_history: Array.isArray(payload.evolution_history)
                    ? (payload.evolution_history as Json[])
                    : [],
                  created_at: (payload.created_at as string) ?? now,
                  updated_at: (payload.updated_at as string) ?? now,
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
            return {
              async then(
                resolve: (value: { error: null }) => unknown,
                reject?: (reason?: unknown) => unknown
              ) {
                for (const row of applyFilters()) {
                  Object.assign(row, values);
                }
                return Promise.resolve({ error: null }).then(resolve, reject);
              },
            };
          },
        };
      },
    };
  }

  private contextTable() {
    const self = this;
    let filters: Array<{ column: string; value: string }> = [];
    let orderBy: { column: string; ascending: boolean } | null = null;

    const applyFilters = () =>
      Array.from(self.contextEntries.values()).filter((row) =>
        filters.every(
          (filter) => String((row as unknown as Record<string, unknown>)[filter.column]) === filter.value
        )
      );

    return {
      select() {
        const query = {
          eq(column: string, value: string) {
            filters.push({ column, value });
            return query;
          },
          order(column: string, options?: { ascending?: boolean }) {
            orderBy = { column, ascending: options?.ascending !== false };
            return query;
          },
          async then(
            resolve: (value: { data: ContextMemoryEntry[]; error: null }) => unknown,
            reject?: (reason?: unknown) => unknown
          ) {
            let rows = applyFilters();
            if (orderBy) {
              rows = [...rows].sort((left, right) => {
                const leftValue = String((left as unknown as Record<string, unknown>)[orderBy!.column] || "");
                const rightValue = String((right as unknown as Record<string, unknown>)[orderBy!.column] || "");
                return orderBy!.ascending ? leftValue.localeCompare(rightValue) : rightValue.localeCompare(leftValue);
              });
            }
            return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
          },
        };
        return query;
      },
    };
  }
}

function seedSubcategory(
  supabase: FakeSupabase,
  overrides?: Partial<Subcategory>
): Subcategory {
  const row: Subcategory = {
    id: `subcategory-seed-${supabase.sequence++}`,
    user_id: "user-1",
    name: "Manager Emails",
    parent_chamber: "career",
    aggregate_fingerprint: {},
    confidence_level: 0,
    document_count: 4,
    total_word_count: 1200,
    last_trained_at: null,
    evolution_history: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
  supabase.subcategories.set(row.id, row);
  return row;
}

function seedContext(
  supabase: FakeSupabase,
  overrides?: Partial<ContextMemoryEntry>
): ContextMemoryEntry {
  const row: ContextMemoryEntry = {
    id: `context-${supabase.sequence++}`,
    user_id: "user-1",
    subcategory_id: "subcategory-1",
    entity_type: "person",
    entity_name: "Sarah",
    attributes: { role: "Manager" },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
  supabase.contextEntries.set(row.id, row);
  return row;
}

test.describe("mirror subcategory service", () => {
  test("create subcategory succeeds with valid name and chamber", async () => {
    const supabase = new FakeSupabase();

    const result = await createSubcategory(
      "user-1",
      " Manager Emails ",
      "career",
      supabase as unknown as SupabaseClient
    );

    expect(result.name).toBe("Manager Emails");
    expect(result.parent_chamber).toBe("career");
  });

  test("duplicate name under same chamber returns existing record without error", async () => {
    const supabase = new FakeSupabase();
    const existing = seedSubcategory(supabase, { name: "Manager Emails", parent_chamber: "career" });

    const result = await createSubcategory(
      "user-1",
      "Manager Emails",
      "career",
      supabase as unknown as SupabaseClient
    );

    expect(result.id).toBe(existing.id);
    expect(supabase.subcategories.size).toBe(1);
  });

  test("same name under different chamber creates new independent record", async () => {
    const supabase = new FakeSupabase();
    seedSubcategory(supabase, { name: "Manager Emails", parent_chamber: "career" });

    const result = await createSubcategory(
      "user-1",
      "Manager Emails",
      "academic",
      supabase as unknown as SupabaseClient
    );

    expect(result.parent_chamber).toBe("academic");
    expect(supabase.subcategories.size).toBe(2);
  });

  test("empty name throws error", async () => {
    const supabase = new FakeSupabase();

    await expect(
      createSubcategory("user-1", "   ", "career", supabase as unknown as SupabaseClient)
    ).rejects.toThrow("Subcategory name is required");
  });

  test("name over 50 characters throws error", async () => {
    const supabase = new FakeSupabase();

    await expect(
      createSubcategory("user-1", "x".repeat(51), "career", supabase as unknown as SupabaseClient)
    ).rejects.toThrow("50 characters or fewer");
  });

  test("name at exactly 50 characters is accepted", async () => {
    const supabase = new FakeSupabase();
    const exactLengthName = "x".repeat(50);

    const result = await createSubcategory(
      "user-1",
      exactLengthName,
      "career",
      supabase as unknown as SupabaseClient
    );

    expect(result.name).toBe(exactLengthName);
  });

  test("updateSubcategoryFingerprint appends to evolution_history correctly", async () => {
    const supabase = new FakeSupabase();
    const subcategory = seedSubcategory(supabase, {
      id: "subcategory-1",
      evolution_history: [{ updated_at: "2026-03-01T00:00:00.000Z", document_count: 1 }],
    });

    await updateSubcategoryFingerprint(
      subcategory.id,
      { cadence: "tight" },
      5,
      2000,
      supabase as unknown as SupabaseClient
    );

    const updated = supabase.subcategories.get(subcategory.id)!;
    expect(updated.aggregate_fingerprint).toEqual({ cadence: "tight" });
    expect(updated.document_count).toBe(5);
    expect(updated.total_word_count).toBe(2000);
    expect(updated.last_trained_at).not.toBeNull();
    expect(updated.evolution_history).toHaveLength(2);
    expect(updated.evolution_history[1]).toMatchObject({
      document_count: 5,
      total_word_count: 2000,
    });
  });

  test("getInheritanceBlend returns correct ratios at counts 0, 2, 3, 9, 10, 50", () => {
    expect(getInheritanceBlend(0)).toEqual({
      parentWeight: 1,
      subcategoryWeight: 0,
      threshold: "developing",
    });
    expect(getInheritanceBlend(2)).toEqual({
      parentWeight: 1,
      subcategoryWeight: 0,
      threshold: "developing",
    });
    expect(getInheritanceBlend(3)).toEqual({
      parentWeight: 0.6,
      subcategoryWeight: 0.4,
      threshold: "emerging",
    });
    expect(getInheritanceBlend(9)).toEqual({
      parentWeight: 0.6,
      subcategoryWeight: 0.4,
      threshold: "emerging",
    });
    expect(getInheritanceBlend(10)).toEqual({
      parentWeight: 0.2,
      subcategoryWeight: 0.8,
      threshold: "established",
    });
    expect(getInheritanceBlend(50)).toEqual({
      parentWeight: 0.2,
      subcategoryWeight: 0.8,
      threshold: "established",
    });
  });

  test("getSubcategoryWithContextMemory returns subcategory plus context entries", async () => {
    const supabase = new FakeSupabase();
    const subcategory = seedSubcategory(supabase, { id: "subcategory-1" });
    seedContext(supabase, {
      subcategory_id: subcategory.id,
      entity_name: "Sarah",
    });
    seedContext(supabase, {
      subcategory_id: subcategory.id,
      entity_name: "TechCorp",
      entity_type: "company",
    });

    const result = await getSubcategoryWithContextMemory(
      "user-1",
      subcategory.id,
      supabase as unknown as SupabaseClient
    );

    expect(result.subcategory.id).toBe(subcategory.id);
    expect(result.contextMemory).toHaveLength(2);
    expect(result.contextMemory.map((entry) => entry.entity_name)).toEqual(["Sarah", "TechCorp"]);
  });

  test("getSubcategories orders by document_count descending and getSubcategory returns matching row", async () => {
    const supabase = new FakeSupabase();
    const lower = seedSubcategory(supabase, { id: "subcategory-low", document_count: 2, name: "One" });
    const higher = seedSubcategory(supabase, { id: "subcategory-high", document_count: 8, name: "Two" });

    const rows = await getSubcategories("user-1", "career", supabase as unknown as SupabaseClient);
    const single = await getSubcategory("user-1", higher.id, supabase as unknown as SupabaseClient);

    expect(rows.map((row) => row.id)).toEqual([higher.id, lower.id]);
    expect(single?.id).toBe(higher.id);
  });
});
