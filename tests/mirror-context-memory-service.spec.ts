import { expect, test } from "playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  deleteContextMemoryEntry,
  extractContextObservations,
  extractContextObservationsWithDeps,
  generateUrsieRecommendationMessageWithDeps,
  getContextMemoryForSubcategory,
  saveContextMemory,
  type ContextObservations,
} from "@/lib/mirror-core/contextMemoryService";
import {
  detectAcknowledgment,
  generateRedirectMessageWithDeps,
} from "@/lib/mirror-mode/playgroundAcknowledgment";

type MemoryRow = {
  id: string;
  user_id: string;
  subcategory_id: string;
  entity_type: "person" | "company" | "place" | "role" | "other";
  entity_name: string;
  attributes: Record<string, string>;
  created_at: string;
  updated_at: string;
};

class ContextMemorySupabase {
  rows: MemoryRow[] = [];

  from(table: string) {
    if (table !== "mirror_context_memory") {
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
          order() {
            return Promise.resolve({
              data: self.rows.filter((row) =>
                filters.every((filter) => String((row as Record<string, unknown>)[filter.column]) === filter.value)
              ),
              error: null,
            });
          },
          maybeSingle() {
            const row =
              self.rows.find((candidate) =>
                filters.every(
                  (filter) =>
                    String((candidate as Record<string, unknown>)[filter.column]) === filter.value
                )
              ) || null;
            return Promise.resolve({ data: row, error: null });
          },
        };
        return query;
      },
      insert(payload: Record<string, unknown>) {
        const row: MemoryRow = {
          id: String(payload.id || `entry-${self.rows.length + 1}`),
          user_id: String(payload.user_id),
          subcategory_id: String(payload.subcategory_id),
          entity_type: payload.entity_type as MemoryRow["entity_type"],
          entity_name: String(payload.entity_name),
          attributes: (payload.attributes || {}) as Record<string, string>,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        self.rows.push(row);
        return Promise.resolve({ error: null });
      },
      update(values: Record<string, unknown>) {
        const query = {
          eq(column: string, value: string) {
            filters.push({ column, value });
            return query;
          },
          then(
            resolve: (value: { error: null }) => unknown,
            reject?: (reason?: unknown) => unknown
          ) {
            for (const row of self.rows) {
              if (
                filters.every(
                  (filter) => String((row as Record<string, unknown>)[filter.column]) === filter.value
                )
              ) {
                Object.assign(row, values);
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
            self.rows = self.rows.filter(
              (row) =>
                !filters.every(
                  (filter) => String((row as Record<string, unknown>)[filter.column]) === filter.value
                )
            );
            return Promise.resolve({ error: null }).then(resolve, reject);
          },
        };
        return query;
      },
    };
  }
}

function observationFixture(): ContextObservations {
  return {
    people: [
      {
        name: "Sarah",
        role: "Engineering Manager",
        company: "TechCorp",
        pronouns: "she/her",
      },
    ],
    writing_type: "professional email",
    relationship_direction: "upward",
    tone_observed: "formal but direct",
    recommended_chamber: "career",
    recommended_subcategory: "Manager Emails",
    recommendation_confidence: "high",
    recommendation_reasoning: "upward relationship and professional register",
  };
}

test.describe("mirror context memory service", () => {
  test("extractContextObservations returns structured observations with people array", async () => {
    const result = await extractContextObservationsWithDeps("Email draft mentioning Sarah at TechCorp.", undefined, {
      runClaude: async () =>
        JSON.stringify({
          people: [{ name: "Sarah", role: "manager", company: "TechCorp", pronouns: "she/her" }],
          writing_type: "professional email",
          relationship_direction: "upward",
          tone_observed: "formal but direct",
          recommended_chamber: "career",
          recommended_subcategory: "Manager Emails",
          recommendation_confidence: "high",
          recommendation_reasoning: "Manager relationship and professional register.",
        }),
    });

    expect(result.people).toEqual([
      { name: "Sarah", role: "manager", company: "TechCorp", pronouns: "she/her" },
    ]);
    expect(result.recommended_chamber).toBe("career");
    expect(result.recommendation_confidence).toBe("high");
  });

  test("extractContextObservations returns safe empty result on failure and does not throw", async () => {
    await expect(extractContextObservations("This should fail gracefully.")).resolves.toMatchObject({
      people: [],
      recommended_chamber: "general",
      recommendation_confidence: "low",
    });
  });

  test("saveContextMemory merges existing entries and does not create duplicates", async () => {
    const supabase = new ContextMemorySupabase();
    supabase.rows.push({
      id: "entry-1",
      user_id: "user-1",
      subcategory_id: "sub-1",
      entity_type: "person",
      entity_name: "Sarah",
      attributes: { role: "Manager" },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await saveContextMemory("user-1", "sub-1", observationFixture(), supabase as unknown as SupabaseClient);

    expect(supabase.rows).toHaveLength(1);
    expect(supabase.rows[0]?.attributes).toMatchObject({
      role: "Engineering Manager",
      company: "TechCorp",
      pronouns: "she/her",
    });
  });

  test("saveContextMemory is a no-op when no people are observed", async () => {
    const supabase = new ContextMemorySupabase();

    await saveContextMemory(
      "user-1",
      "sub-1",
      {
        ...observationFixture(),
        people: [],
      },
      supabase as unknown as SupabaseClient
    );

    expect(supabase.rows).toHaveLength(0);
  });

  test("saveContextMemory with multiple people creates multiple entries", async () => {
    const supabase = new ContextMemorySupabase();

    await saveContextMemory(
      "user-1",
      "sub-1",
      {
        ...observationFixture(),
        people: [
          {
            name: "Sarah",
            role: "Engineering Manager",
            company: "TechCorp",
            pronouns: "she/her",
          },
          {
            name: "David",
            role: "Peer Engineer",
            company: "TechCorp",
            pronouns: "he/him",
          },
        ],
      },
      supabase as unknown as SupabaseClient
    );

    expect(supabase.rows).toHaveLength(2);
    expect(supabase.rows.map((row) => row.entity_name).sort()).toEqual(["David", "Sarah"]);
  });

  test("deleteContextMemoryEntry rejects deletion when userId does not match owner", async () => {
    const supabase = new ContextMemorySupabase();
    supabase.rows.push({
      id: "entry-1",
      user_id: "owner-1",
      subcategory_id: "sub-1",
      entity_type: "person",
      entity_name: "Sarah",
      attributes: { role: "Manager" },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await expect(
      deleteContextMemoryEntry("entry-1", "user-2", supabase as unknown as SupabaseClient)
    ).rejects.toThrow("Context memory entry not found");
    expect(supabase.rows).toHaveLength(1);
  });

  test("deleteContextMemoryEntry with matching userId succeeds", async () => {
    const supabase = new ContextMemorySupabase();
    supabase.rows.push({
      id: "entry-1",
      user_id: "user-1",
      subcategory_id: "sub-1",
      entity_type: "person",
      entity_name: "Sarah",
      attributes: { role: "Manager" },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await expect(
      deleteContextMemoryEntry("entry-1", "user-1", supabase as unknown as SupabaseClient)
    ).resolves.toBeUndefined();
    expect(supabase.rows).toHaveLength(0);
  });

  test("detectAcknowledgment returns true for natural acknowledgment messages", async () => {
    expect(detectAcknowledgment("Got it. I'll check the queue now.")).toBe(true);
    expect(detectAcknowledgment("Okay, I saw it and I will review that classification.")).toBe(true);
  });

  test("detectAcknowledgment returns false for subject-change messages", async () => {
    expect(detectAcknowledgment("Can you draft the follow-up email instead?")).toBe(false);
    expect(detectAcknowledgment("Another thing, write this note to my professor.")).toBe(false);
  });

  test("generateRedirectMessage returns non-empty string at each redirect count", async () => {
    const outputs: string[] = [];

    for (const redirectCount of [1, 2, 3]) {
      const output = await generateRedirectMessageWithDeps(
        {
          redirectCount,
          recommendationContext: "Sarah at TechCorp looks like a manager email.",
          userMessage: "Can you just write the draft now?",
        },
        "You are Ursie. Be direct.",
        {
          runClaude: async ({ prompt }) => {
            outputs.push(prompt);
            return `Redirect ${redirectCount}`;
          },
        }
      );

      expect(output).toBe(`Redirect ${redirectCount}`);
    }

    expect(outputs[0]).toContain("This is the first redirect. Be gentle, patient, and direct.");
    expect(outputs[1]).toContain("This is the second redirect. Be firmer, but still warm.");
    expect(outputs[2]).toContain("This is the third redirect. Tell the user you will leave it there for now and that you will remember.");
  });

  test("getContextMemoryForSubcategory returns stored entries ordered by entity name", async () => {
    const supabase = new ContextMemorySupabase();
    supabase.rows.push({
      id: "entry-2",
      user_id: "user-1",
      subcategory_id: "sub-1",
      entity_type: "person",
      entity_name: "Zara",
      attributes: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    supabase.rows.push({
      id: "entry-1",
      user_id: "user-1",
      subcategory_id: "sub-1",
      entity_type: "person",
      entity_name: "Ava",
      attributes: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const entries = await getContextMemoryForSubcategory(
      "user-1",
      "sub-1",
      supabase as unknown as SupabaseClient
    );

    expect(entries).toHaveLength(2);
  });

  test("generateUrsieRecommendationMessage returns non-empty generated text", async () => {
    const result = await generateUrsieRecommendationMessageWithDeps(observationFixture(), "user-1", {
      runClaude: async () => "I caught the shape of that note to Sarah at TechCorp. I set it aside in your queue so you can place it when you are ready.",
    });

    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain("Sarah");
  });
});
