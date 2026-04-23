import { expect, test, type Page, type Route } from "playwright/test";

type ConsentState = Record<
  "career" | "academic" | "creative" | "general",
  { consented: boolean; consented_at: string | null }
>;

const baseConsent: ConsentState = {
  career: { consented: false, consented_at: null },
  academic: { consented: false, consented_at: null },
  creative: { consented: false, consented_at: null },
  general: { consented: false, consented_at: null },
};

const baseDashboard = {
  success: true,
  overall: {
    confidenceLevel: 0.82,
    confidenceLabel: "Strong",
    documentCount: 12,
    totalWordCount: 18400,
    lastTrainedAt: "2026-03-22T12:00:00.000Z",
    updatedAt: "2026-03-22T12:00:00.000Z",
  },
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
  queueCount: 1,
  recentCaptures: [],
};

async function enableE2EAuth(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("e2e-auth", "1");
    window.localStorage.setItem("tw-mirror-capture-enabled", "1");
  });
}

async function fulfillSettingsBootstrap(
  route: Route,
  options?: {
    consent?: ConsentState;
    rules?: unknown[];
    queueItems?: unknown[];
    dashboard?: typeof baseDashboard;
    contextMemory?: unknown[];
    subcategories?: Partial<Record<"career" | "academic" | "creative" | "general", unknown[]>>;
  }
) {
  const url = route.request().url();
  const method = route.request().method();
  if (method === "GET" && url.endsWith("/api/mirror/consent")) {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, consent: options?.consent ?? baseConsent }),
    });
    return true;
  }
  if (method === "GET" && url.endsWith("/api/mirror/domain-rules")) {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, rules: options?.rules ?? [] }),
    });
    return true;
  }
  if (method === "GET" && url.endsWith("/api/mirror/unclassified")) {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, items: options?.queueItems ?? [] }),
    });
    return true;
  }
  if (method === "GET" && url.endsWith("/api/mirror/dashboard")) {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(options?.dashboard ?? baseDashboard),
    });
    return true;
  }
  if (method === "GET" && url.endsWith("/api/mirror/context-memory")) {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ subcategories: options?.contextMemory ?? [] }),
    });
    return true;
  }
  if (method === "GET" && url.includes("/api/mirror/subcategories?chamber=")) {
    const chamberParam = new URL(url).searchParams.get("chamber");
    const chamber =
      chamberParam === "career" ||
      chamberParam === "academic" ||
      chamberParam === "creative" ||
      chamberParam === "general"
        ? chamberParam
        : null;

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        subcategories: chamber ? options?.subcategories?.[chamber] ?? [] : [],
      }),
    });
    return true;
  }
  return false;
}

test.describe("mirror standalone UI", () => {
  test("consent toggle creates mirror_mode_consent record", async ({ page }) => {
    await enableE2EAuth(page);

    let postedBody: unknown = null;

    await page.route("**/api/mirror/**", async (route) => {
      if (await fulfillSettingsBootstrap(route)) return;
      if (route.request().method() === "POST" && route.request().url().endsWith("/api/mirror/consent")) {
        postedBody = route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, consented: true }),
        });
        return;
      }
      await route.abort();
    });

    await page.goto("/mirror/settings");
    await page.getByTestId("consent-toggle-general").click();

    expect(postedBody).toEqual({ studio: "general" });
  });

  test("consent toggle delete removes record", async ({ page }) => {
    await enableE2EAuth(page);

    let deletedBody: unknown = null;
    page.on("dialog", (dialog) => dialog.accept());

    await page.route("**/api/mirror/**", async (route) => {
      if (
        await fulfillSettingsBootstrap(route, {
          consent: {
            ...baseConsent,
            general: { consented: true, consented_at: "2026-03-22T12:00:00.000Z" },
          },
        })
      ) {
        return;
      }
      if (route.request().method() === "DELETE" && route.request().url().endsWith("/api/mirror/consent")) {
        deletedBody = route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, consented: false }),
        });
        return;
      }
      await route.abort();
    });

    await page.goto("/mirror/settings");
    await page.getByTestId("consent-toggle-general").click();

    expect(deletedBody).toEqual({ studio: "general" });
  });

  test("domain rule create and delete works end to end", async ({ page }) => {
    await enableE2EAuth(page);

    const requests: unknown[] = [];

    await page.route("**/api/mirror/**", async (route) => {
      if (
        await fulfillSettingsBootstrap(route, {
          rules: [
            {
              id: "rule-1",
              domain: "docs.google.com",
              target_chamber: "academic",
              created_at: "2026-03-22T12:00:00.000Z",
              updated_at: "2026-03-22T12:00:00.000Z",
            },
          ],
        })
      ) {
        return;
      }
      const request = route.request();
      if (request.method() === "POST" && request.url().endsWith("/api/mirror/domain-rules")) {
        requests.push(request.postDataJSON());
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            rule: {
              id: "rule-2",
              domain: "mail.google.com",
              target_chamber: "career",
              created_at: "2026-03-22T12:00:00.000Z",
              updated_at: "2026-03-22T12:00:00.000Z",
            },
          }),
        });
        return;
      }
      if (request.method() === "DELETE" && request.url().endsWith("/api/mirror/domain-rules/rule-1")) {
        requests.push({ delete: "rule-1" });
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
    await page.getByTestId("domain-rule-input").fill("mail.google.com");
    await page.getByTestId("save-domain-rule").click();
    await page.getByTestId("delete-domain-rule-rule-1").click();

    expect(requests).toEqual([
      { domain: "mail.google.com", target_chamber: "general" },
      { delete: "rule-1" },
    ]);
  });

  test("queue classify from UI works correctly", async ({ page }) => {
    await enableE2EAuth(page);

    let classifyBody: unknown = null;

    await page.route("**/api/mirror/unclassified", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          items: [
            {
              id: "queue-1",
              source_domain: "news.example.com",
              word_count: 380,
              captured_at: "2026-03-22T12:00:00.000Z",
              fingerprint_data: {
                avgSentenceLength: 18.2,
                lexicalDensity: 0.61,
                hedgeWordRate: 0.08,
              },
            },
          ],
        }),
      });
    });

    await page.route("**/api/mirror/unclassified/queue-1/classify", async (route) => {
      classifyBody = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto("/mirror/queue");
    await page.getByTestId("classify-item-queue-1").click();

    expect(classifyBody).toEqual({ chamber: "general", create_domain_rule: false });
    await expect(page.getByText("Nothing to review.")).toBeVisible();
  });

  test("purge requires typed confirmation", async ({ page }) => {
    await enableE2EAuth(page);

    let purgeBody: unknown = null;

    await page.route("**/api/mirror/**", async (route) => {
      if (await fulfillSettingsBootstrap(route)) return;
      if (route.request().method() === "POST" && route.request().url().endsWith("/api/mirror/purge")) {
        purgeBody = route.request().postDataJSON();
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
    const button = page.getByTestId("purge-button-general");
    await expect(button).toBeDisabled();

    await page.getByTestId("purge-confirmation-general").fill("DELETE");
    await expect(button).toBeEnabled();
    await button.click();

    expect(purgeBody).toEqual({ scope: "general", confirmation: "DELETE" });
  });

  test("voice profile section reads from voice_chambers", async ({ page }) => {
    await enableE2EAuth(page);

    await page.route("**/api/mirror/**", async (route) => {
      if (
        await fulfillSettingsBootstrap(route, {
          dashboard: {
            ...baseDashboard,
            chambers: {
              ...baseDashboard.chambers,
              overall: {
                confidenceLevel: 0.91,
                confidenceLabel: "Entrenched",
                documentCount: 21,
                totalWordCount: 48120,
                lastTrainedAt: "2026-03-22T12:00:00.000Z",
                updatedAt: "2026-03-22T12:00:00.000Z",
              },
            },
          },
        })
      ) {
        return;
      }
      await route.abort();
    });

    await page.goto("/mirror/settings");

    await expect(page.getByText("Source: voice_chambers")).toBeVisible();
    await expect(page.getByText("48,120")).toBeVisible();
    await expect(page.getByText("Entrenched")).toBeVisible();
  });
});
