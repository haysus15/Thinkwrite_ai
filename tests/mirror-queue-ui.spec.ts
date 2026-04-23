import { expect, test, type Page, type Route } from "playwright/test";

async function enableE2EAuth(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("e2e-auth", "1");
  });
}

function queueItem(overrides?: Record<string, unknown>) {
  return {
    id: "queue-1",
    source_domain: "mail.google.com",
    fingerprint_data: {
      avgSentenceLength: 15,
      lexicalDensity: 0.54,
      hedgeWordRate: 0.08,
    },
    word_count: 184,
    captured_at: "2026-03-26T09:00:00.000Z",
    context_observations: {
      people: [{ name: "Sarah", role: "Manager", company: "TechCorp" }],
      writing_type: "Professional email",
      relationship_direction: "upward",
      tone_observed: "Formal",
    },
    ursie_recommendation: {
      chamber: "career",
      subcategory_name: "Manager Emails",
      confidence: "high",
      reasoning: "manager relationship and professional register",
    },
    subcategory_id: null,
    subcategory_confirmed: false,
    ...overrides,
  };
}

async function fulfillQueueRoute(route: Route, options?: { items?: unknown[] }) {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      success: true,
      items: options?.items ?? [queueItem()],
    }),
  });
}

test.describe("mirror queue UI", () => {
  test("Ursie noticed line renders when context_observations has people", async ({ page }) => {
    await enableE2EAuth(page);

    await page.route("**/api/mirror/unclassified", (route) => fulfillQueueRoute(route));
    await page.route("**/api/mirror/subcategories?chamber=career", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          subcategories: [
            {
              id: "sub-1",
              name: "Manager Emails",
              parent_chamber: "career",
              document_count: 4,
              confidence_level: 0.62,
            },
          ],
        }),
      });
    });

    await page.goto("/mirror/queue");

    await expect(page.getByTestId("ursie-noticed-queue-1")).toContainText(
      "Ursie noticed Sarah · Manager · TechCorp"
    );
  });

  test("Ursie noticed line does not render when context_observations is empty", async ({ page }) => {
    await enableE2EAuth(page);

    await page.route("**/api/mirror/unclassified", (route) =>
      fulfillQueueRoute(route, {
        items: [
          queueItem({
            id: "queue-2",
            context_observations: {},
            ursie_recommendation: null,
          }),
        ],
      })
    );
    await page.route("**/api/mirror/subcategories?chamber=general", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, subcategories: [] }),
      });
    });

    await page.goto("/mirror/queue");

    await expect(page.getByTestId("ursie-noticed-queue-2")).toHaveCount(0);
  });

  test("Ursie's recommendation pre-selects chamber and subcategory in dropdowns", async ({ page }) => {
    await enableE2EAuth(page);

    await page.route("**/api/mirror/unclassified", (route) => fulfillQueueRoute(route));
    await page.route("**/api/mirror/subcategories?chamber=career", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          subcategories: [
            {
              id: "sub-1",
              name: "Manager Emails",
              parent_chamber: "career",
              document_count: 4,
              confidence_level: 0.62,
            },
          ],
        }),
      });
    });

    await page.goto("/mirror/queue");

    await expect(page.getByTestId("queue-chamber-queue-1")).toHaveValue("career");
    await expect(page.getByTestId("subcategory-select-queue-1")).toHaveValue("sub-1");
  });

  test("subcategory dropdown appears after chamber selection", async ({ page }) => {
    await enableE2EAuth(page);

    await page.route("**/api/mirror/unclassified", (route) =>
      fulfillQueueRoute(route, {
        items: [queueItem({ id: "queue-3", ursie_recommendation: null })],
      })
    );
    await page.route("**/api/mirror/subcategories?chamber=general", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, subcategories: [] }),
      });
    });
    await page.route("**/api/mirror/subcategories?chamber=academic", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          subcategories: [
            {
              id: "sub-2",
              name: "Thesis Writing",
              parent_chamber: "academic",
              document_count: 3,
              confidence_level: 0.51,
            },
          ],
        }),
      });
    });

    await page.goto("/mirror/queue");
    await page.getByTestId("queue-chamber-queue-3").selectOption("academic");

    await expect(page.getByTestId("subcategory-select-queue-3")).toBeVisible();
  });

  test("create new subcategory option triggers inline text input", async ({ page }) => {
    await enableE2EAuth(page);

    await page.route("**/api/mirror/unclassified", (route) => fulfillQueueRoute(route));
    await page.route("**/api/mirror/subcategories?chamber=career", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, subcategories: [] }),
      });
    });

    await page.goto("/mirror/queue");
    await page.getByTestId("subcategory-select-queue-1").selectOption("__create__");

    await expect(page.getByTestId("subcategory-create-input-queue-1")).toBeVisible();
  });

  test("skip for now classifies to chamber only with no subcategory fields", async ({ page }) => {
    await enableE2EAuth(page);

    let classifyBody: Record<string, unknown> | null = null;

    await page.route("**/api/mirror/unclassified", (route) => fulfillQueueRoute(route));
    await page.route("**/api/mirror/subcategories?chamber=career", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, subcategories: [] }),
      });
    });
    await page.route("**/api/mirror/unclassified/queue-1/classify", async (route) => {
      classifyBody = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto("/mirror/queue");
    await page.getByTestId("subcategory-select-queue-1").selectOption("__skip__");
    await page.getByTestId("classify-item-queue-1").click();

    expect(classifyBody).toEqual({
      chamber: "career",
      create_domain_rule: false,
    });
  });

  test("classify with existing subcategory sends correct subcategory_id in body", async ({ page }) => {
    await enableE2EAuth(page);

    let classifyBody: Record<string, unknown> | null = null;

    await page.route("**/api/mirror/unclassified", (route) => fulfillQueueRoute(route));
    await page.route("**/api/mirror/subcategories?chamber=career", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          subcategories: [
            {
              id: "sub-1",
              name: "Manager Emails",
              parent_chamber: "career",
              document_count: 4,
              confidence_level: 0.62,
            },
          ],
        }),
      });
    });
    await page.route("**/api/mirror/unclassified/queue-1/classify", async (route) => {
      classifyBody = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto("/mirror/queue");
    await page.getByTestId("subcategory-select-queue-1").selectOption("sub-1");
    await page.getByTestId("classify-item-queue-1").click();

    expect(classifyBody).toEqual({
      chamber: "career",
      create_domain_rule: false,
      subcategory_id: "sub-1",
    });
  });

  test("classify with new subcategory sends correct subcategory_name in body", async ({ page }) => {
    await enableE2EAuth(page);

    let classifyBody: Record<string, unknown> | null = null;

    await page.route("**/api/mirror/unclassified", (route) =>
      fulfillQueueRoute(route, {
        items: [
          queueItem({
            id: "queue-4",
            ursie_recommendation: null,
          }),
        ],
      })
    );
    await page.route("**/api/mirror/subcategories?chamber=general", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, subcategories: [] }),
      });
    });
    await page.route("**/api/mirror/unclassified/queue-4/classify", async (route) => {
      classifyBody = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto("/mirror/queue");
    await page.getByTestId("subcategory-select-queue-4").selectOption("__create__");
    await page.getByTestId("subcategory-create-input-queue-4").fill("New Context");
    await page.getByTestId("classify-item-queue-4").click();

    expect(classifyBody).toEqual({
      chamber: "general",
      create_domain_rule: false,
      subcategory_name: "New Context",
    });
  });
});
