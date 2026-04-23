import { expect, test } from "playwright/test";
import { NextRequest } from "next/server.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  handleDeleteContextMemory,
  handleGetContextMemory,
  handlePatchContextMemory,
  handlePostContextMemory,
} from "@/app/api/mirror/context-memory/handler";

type SubcategoryRow = {
  id: string;
  user_id: string;
  name: string;
  parent_chamber: "career" | "academic" | "creative" | "general";
  aggregate_fingerprint: Record<string, unknown>;
  confidence_level: number;
  document_count: number;
  total_word_count: number;
  last_trained_at: string | null;
  evolution_history: unknown[];
  created_at: string;
  updated_at: string;
};

type ContextRow = {
  id: string;
  user_id: string;
  subcategory_id: string;
  entity_type: "person" | "company" | "place" | "role" | "other";
  entity_name: string;
  attributes: Record<string, string>;
  created_at: string;
  updated_at: string;
};

class ContextMemoryApiSupabase {
  subcategories = new Map<string, SubcategoryRow>();
  entries = new Map<string, ContextRow>();
  sequence = 1;

  from(table: string) {
    if (table === "mirror_subcategories") {
      const self = this;
      let filters: Array<{ column: string; value: string }> = [];
      const orderings: Array<{ column: string; ascending: boolean }> = [];
      return {
        select() {
          const query = {
            eq(column: string, value: string) {
              filters.push({ column, value });
              return query;
            },
            order(column: string, options?: { ascending?: boolean }) {
              orderings.push({ column, ascending: options?.ascending ?? true });
              return query;
            },
            then(
              resolve: (value: { data: SubcategoryRow[]; error: null }) => unknown,
              reject?: (reason?: unknown) => unknown
            ) {
              const rows = Array.from(self.subcategories.values()).filter((row) =>
                filters.every(
                  (filter) => String((row as Record<string, unknown>)[filter.column]) === filter.value
                )
              );
              rows.sort((left, right) => {
                for (const ordering of orderings) {
                  const leftValue = left[ordering.column as keyof SubcategoryRow];
                  const rightValue = right[ordering.column as keyof SubcategoryRow];
                  if (leftValue === rightValue) {
                    continue;
                  }
                  if (leftValue == null) {
                    return ordering.ascending ? -1 : 1;
                  }
                  if (rightValue == null) {
                    return ordering.ascending ? 1 : -1;
                  }
                  if (leftValue < rightValue) {
                    return ordering.ascending ? -1 : 1;
                  }
                  if (leftValue > rightValue) {
                    return ordering.ascending ? 1 : -1;
                  }
                }
                return 0;
              });
              return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
            },
            async maybeSingle() {
              const row =
                Array.from(self.subcategories.values()).find((candidate) =>
                  filters.every(
                    (filter) => String((candidate as Record<string, unknown>)[filter.column]) === filter.value
                  )
                ) || null;
              return { data: row, error: null };
            },
          };
          return query;
        },
      };
    }

    if (table === "mirror_context_memory") {
      const self = this;
      let filters: Array<{ column: string; value: string }> = [];
      const orderings: Array<{ column: string; ascending: boolean }> = [];
      return {
        select() {
          const query = {
            eq(column: string, value: string) {
              filters.push({ column, value });
              return query;
            },
            order(column: string, options?: { ascending?: boolean }) {
              orderings.push({ column, ascending: options?.ascending ?? true });
              return query;
            },
            then(
              resolve: (value: { data: ContextRow[]; error: null }) => unknown,
              reject?: (reason?: unknown) => unknown
            ) {
              const rows = Array.from(self.entries.values()).filter((row) =>
                filters.every(
                  (filter) => String((row as Record<string, unknown>)[filter.column]) === filter.value
                )
              );
              rows.sort((left, right) => {
                for (const ordering of orderings) {
                  const leftValue = left[ordering.column as keyof ContextRow];
                  const rightValue = right[ordering.column as keyof ContextRow];
                  if (leftValue === rightValue) {
                    continue;
                  }
                  if (leftValue == null) {
                    return ordering.ascending ? -1 : 1;
                  }
                  if (rightValue == null) {
                    return ordering.ascending ? 1 : -1;
                  }
                  if (leftValue < rightValue) {
                    return ordering.ascending ? -1 : 1;
                  }
                  if (leftValue > rightValue) {
                    return ordering.ascending ? 1 : -1;
                  }
                }
                return 0;
              });
              return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
            },
            async maybeSingle() {
              const row =
                Array.from(self.entries.values()).find((candidate) =>
                  filters.every(
                    (filter) => String((candidate as Record<string, unknown>)[filter.column]) === filter.value
                  )
                ) || null;
              return { data: row, error: null };
            },
            async single() {
              const row =
                Array.from(self.entries.values()).find((candidate) =>
                  filters.every(
                    (filter) => String((candidate as Record<string, unknown>)[filter.column]) === filter.value
                  )
                ) || null;
              return { data: row, error: null };
            },
          };
          return query;
        },
        insert(payload: Record<string, unknown>) {
          const row: ContextRow = {
            id: `entry-${self.sequence++}`,
            user_id: String(payload.user_id),
            subcategory_id: String(payload.subcategory_id),
            entity_type: payload.entity_type as ContextRow["entity_type"],
            entity_name: String(payload.entity_name),
            attributes: (payload.attributes || {}) as Record<string, string>,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          self.entries.set(row.id, row);
          return {
            select() {
              return {
                async single() {
                  return { data: row, error: null };
                },
              };
            },
          };
        },
        update(values: Record<string, unknown>) {
          const query = {
            eq(column: string, value: string) {
              filters.push({ column, value });
              return query;
            },
            select() {
              return {
                async single() {
                  let updated: ContextRow | null = null;
                  for (const [id, row] of self.entries.entries()) {
                    if (
                      filters.every(
                        (filter) => String((row as Record<string, unknown>)[filter.column]) === filter.value
                      )
                    ) {
                      updated = { ...row, ...values } as ContextRow;
                      self.entries.set(id, updated);
                    }
                  }
                  return { data: updated, error: null };
                },
              };
            },
            then(
              resolve: (value: { error: null }) => unknown,
              reject?: (reason?: unknown) => unknown
            ) {
              for (const [id, row] of self.entries.entries()) {
                if (
                  filters.every(
                    (filter) => String((row as Record<string, unknown>)[filter.column]) === filter.value
                  )
                ) {
                  self.entries.set(id, { ...row, ...values } as ContextRow);
                }
              }
              return Promise.resolve({ error: null }).then(resolve, reject);
            },
          };
          return query;
        },
        delete() {
          const query = {
            eq(column: string, value: string) {
              filters.push({ column, value });
              return query;
            },
            then(
              resolve: (value: { error: null }) => unknown,
              reject?: (reason?: unknown) => unknown
            ) {
              for (const [id, row] of self.entries.entries()) {
                if (
                  filters.every(
                    (filter) => String((row as Record<string, unknown>)[filter.column]) === filter.value
                  )
                ) {
                  self.entries.delete(id);
                }
              }
              return Promise.resolve({ error: null }).then(resolve, reject);
            },
          };
          return query;
        },
      };
    }

    throw new Error(`Unexpected table ${table}`);
  }
}

function seedSubcategory(): SubcategoryRow {
  return {
    id: "sub-1",
    user_id: "user-1",
    name: "Manager Emails",
    parent_chamber: "career",
    aggregate_fingerprint: {},
    confidence_level: 0.56,
    document_count: 4,
    total_word_count: 1800,
    last_trained_at: new Date().toISOString(),
    evolution_history: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

test.describe("mirror context memory API", () => {
  test("GET returns entries grouped by subcategory", async () => {
    const supabase = new ContextMemoryApiSupabase();
    supabase.subcategories.set("sub-1", seedSubcategory());
    supabase.entries.set("entry-1", {
      id: "entry-1",
      user_id: "user-1",
      subcategory_id: "sub-1",
      entity_type: "person",
      entity_name: "Sarah",
      attributes: { role: "Manager" },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const response = await handleGetContextMemory(
      new NextRequest("http://localhost:3000/api/mirror/context-memory"),
      {
        resolveUserId: async () => "user-1",
        createSupabaseAdmin: () => supabase as unknown as SupabaseClient,
      }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      subcategories: [
        {
          chamber: "career",
          subcategory: { id: "sub-1", name: "Manager Emails" },
          entries: [{ entity_name: "Sarah" }],
        },
      ],
    });
  });

  test("POST creates entry correctly", async () => {
    const supabase = new ContextMemoryApiSupabase();
    supabase.subcategories.set("sub-1", seedSubcategory());

    const response = await handlePostContextMemory(
      new NextRequest("http://localhost:3000/api/mirror/context-memory", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subcategory_id: "sub-1",
          entity_type: "person",
          entity_name: "Sarah",
          attributes: { role: "Engineering Manager" },
        }),
      }),
      {
        resolveUserId: async () => "user-1",
        createSupabaseAdmin: () => supabase as unknown as SupabaseClient,
      }
    );

    expect(response.status).toBe(200);
    expect(Array.from(supabase.entries.values())[0]).toMatchObject({
      entity_name: "Sarah",
      attributes: { role: "Engineering Manager" },
    });
  });

  test("POST merges when entity_name already exists under subcategory", async () => {
    const supabase = new ContextMemoryApiSupabase();
    supabase.subcategories.set("sub-1", seedSubcategory());
    supabase.entries.set("entry-1", {
      id: "entry-1",
      user_id: "user-1",
      subcategory_id: "sub-1",
      entity_type: "person",
      entity_name: "Sarah",
      attributes: { role: "Manager" },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const response = await handlePostContextMemory(
      new NextRequest("http://localhost:3000/api/mirror/context-memory", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subcategory_id: "sub-1",
          entity_type: "person",
          entity_name: "Sarah",
          attributes: { company: "TechCorp" },
        }),
      }),
      {
        resolveUserId: async () => "user-1",
        createSupabaseAdmin: () => supabase as unknown as SupabaseClient,
      }
    );

    expect(response.status).toBe(200);
    expect(supabase.entries.get("entry-1")?.attributes).toMatchObject({
      role: "Manager",
      company: "TechCorp",
    });
    expect(supabase.entries.size).toBe(1);
  });

  test("PATCH updates attributes", async () => {
    const supabase = new ContextMemoryApiSupabase();
    supabase.entries.set("entry-1", {
      id: "entry-1",
      user_id: "user-1",
      subcategory_id: "sub-1",
      entity_type: "person",
      entity_name: "Sarah",
      attributes: { role: "Manager" },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const response = await handlePatchContextMemory(
      new NextRequest("http://localhost:3000/api/mirror/context-memory/entry-1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ attributes: { role: "Engineering Manager" } }),
      }),
      { id: "entry-1" },
      {
        resolveUserId: async () => "user-1",
        createSupabaseAdmin: () => supabase as unknown as SupabaseClient,
      }
    );

    expect(response.status).toBe(200);
    expect(supabase.entries.get("entry-1")?.attributes).toMatchObject({
      role: "Engineering Manager",
    });
  });

  test("PATCH rejects update when userId does not match", async () => {
    const supabase = new ContextMemoryApiSupabase();
    supabase.entries.set("entry-1", {
      id: "entry-1",
      user_id: "user-2",
      subcategory_id: "sub-1",
      entity_type: "person",
      entity_name: "Sarah",
      attributes: { role: "Manager" },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const response = await handlePatchContextMemory(
      new NextRequest("http://localhost:3000/api/mirror/context-memory/entry-1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ attributes: { role: "Engineering Manager" } }),
      }),
      { id: "entry-1" },
      {
        resolveUserId: async () => "user-1",
        createSupabaseAdmin: () => supabase as unknown as SupabaseClient,
      }
    );

    expect(response.status).toBe(404);
  });

  test("DELETE removes entry", async () => {
    const supabase = new ContextMemoryApiSupabase();
    supabase.entries.set("entry-1", {
      id: "entry-1",
      user_id: "user-1",
      subcategory_id: "sub-1",
      entity_type: "person",
      entity_name: "Sarah",
      attributes: { role: "Manager" },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const response = await handleDeleteContextMemory(
      new NextRequest("http://localhost:3000/api/mirror/context-memory/entry-1", {
        method: "DELETE",
      }),
      { id: "entry-1" },
      {
        resolveUserId: async () => "user-1",
        createSupabaseAdmin: () => supabase as unknown as SupabaseClient,
      }
    );

    expect(response.status).toBe(200);
    expect(supabase.entries.size).toBe(0);
  });

  test("DELETE rejects when userId does not match", async () => {
    const supabase = new ContextMemoryApiSupabase();
    supabase.entries.set("entry-1", {
      id: "entry-1",
      user_id: "user-2",
      subcategory_id: "sub-1",
      entity_type: "person",
      entity_name: "Sarah",
      attributes: { role: "Manager" },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const response = await handleDeleteContextMemory(
      new NextRequest("http://localhost:3000/api/mirror/context-memory/entry-1", {
        method: "DELETE",
      }),
      { id: "entry-1" },
      {
        resolveUserId: async () => "user-1",
        createSupabaseAdmin: () => supabase as unknown as SupabaseClient,
      }
    );

    expect(response.status).toBe(404);
    expect(supabase.entries.size).toBe(1);
  });
});
