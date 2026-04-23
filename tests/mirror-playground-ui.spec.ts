import { expect, test, type Page } from "playwright/test";

async function enableE2EAuth(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("e2e-auth", "1");
  });
}

async function mockPlaygroundBootstrap(
  page: Page,
  options?: {
    profileExists?: boolean;
    chatReply?: string;
    chatReady?: boolean;
    generateResponse?: Record<string, unknown>;
  }
) {
  let chatCalls = 0;

  await page.route("**/api/mirror/playground/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ session_id: "session-1" }),
    });
  });

  await page.route("**/api/mirror/playground/session/session-1", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    });
  });

  await page.route("**/api/mirror-mode/voice/profile?includeFingerprint=false", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, exists: options?.profileExists ?? false }),
    });
  });

  await page.route("**/api/mirror-mode/ursie/chat", async (route) => {
    chatCalls += 1;

    if (chatCalls === 1) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          sessionId: "ursie-1",
          message: "Morgan. What do you need.",
          ready_to_generate: false,
          extracted_context: {},
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        sessionId: "ursie-1",
        message: options?.chatReply || "Morgan. Sarah at TechTrade, deadline reset, direct register. Going now.",
        ready_to_generate: options?.chatReady ?? true,
        extracted_context: {
          audience: "Sarah at TechTrade",
          purpose: "Reset the deadline without sounding evasive",
          tone: "direct and accountable",
          names: ["Sarah"],
          companies: ["TechTrade"],
          writing_type: "email",
        },
      }),
    });
  });

  await page.route("**/api/mirror/playground/generate", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        options?.generateResponse || {
          generic_output: "Generic draft.",
          voiced_output: "Voiced draft.",
          confidence_context: null,
          zero_captures_state: false,
          ready: true,
        }
      ),
    });
  });

  await page.route("**/api/mirror/playground/reveal", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        generic_label: "Morgan. This is what the draft sounds like before I know your hand.",
        reveal_statement:
          "Morgan. You said Sarah, then TechTrade, and the register tightened immediately. That is why this one lands with more spine.",
      }),
    });
  });

  await page.route("**/api/mirror/playground/feedback", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        regenerated_output: "Regenerated voiced draft.",
        ursie_feedback_response: "Morgan. I heard the relationship one way and pushed it too far.",
      }),
    });
  });
}

async function openReadyPlayground(page: Page) {
  await page.goto("/mirror/playground");
  await expect(page.getByText("Morgan. What do you need.")).toBeVisible();
  await expect(page.getByTestId("playground-input")).toBeVisible();
}

async function triggerGeneration(page: Page) {
  await page
    .getByTestId("playground-input")
    .fill(
      "I need to write an email to my manager Sarah at TechTrade about moving a deadline because the vendor slipped two milestones and I need her approval without sounding evasive or weak."
    );
  await page.getByTestId("playground-send").click();
}

test.describe("mirror playground UI", () => {
  test("playground page renders with generated Ursie opening visible after load", async ({ page }) => {
    await enableE2EAuth(page);
    await mockPlaygroundBootstrap(page);

    await page.goto("/mirror/playground");

    await expect(page.getByText("Morgan. What do you need.")).toBeVisible();
  });

  test("conversation input present and functional and output zone hidden before generation", async ({
    page,
  }) => {
    await enableE2EAuth(page);
    await mockPlaygroundBootstrap(page, {
      chatReply: "Morgan. Sarah at TechTrade. I have enough.",
      chatReady: false,
    });

    await openReadyPlayground(page);
    await expect(page.getByTestId("playground-output-zone")).toHaveCount(0);

    await page
      .getByTestId("playground-input")
      .fill(
        "I need to write an email to my manager Sarah at TechTrade about moving a deadline because the vendor slipped two milestones and I need her approval without sounding evasive or weak."
      );
    await page.getByTestId("playground-send").click();

    await expect(page.getByText("Morgan. Sarah at TechTrade. I have enough.")).toBeVisible();
    await expect(page.getByTestId("playground-output-zone")).toHaveCount(0);
  });

  test("generic output card appears before voiced output card and voiced output appears after delay", async ({
    page,
  }) => {
    await enableE2EAuth(page);
    await mockPlaygroundBootstrap(page);

    await openReadyPlayground(page);
    await triggerGeneration(page);

    await expect(page.getByTestId("generic-output-card")).toBeVisible();
    await expect(page.getByText("Generic draft.")).toBeVisible();
    await expect(page.getByTestId("voiced-output-card")).not.toBeVisible();

    await page.waitForTimeout(1700);

    await expect(page.getByTestId("voiced-output-card")).toBeVisible();
    await expect(page.getByText("Voiced draft.")).toBeVisible();
  });

  test("this does not sound like me action is visible after voiced output and feedback options appear inline", async ({
    page,
  }) => {
    await enableE2EAuth(page);
    await mockPlaygroundBootstrap(page);

    await openReadyPlayground(page);
    await triggerGeneration(page);
    await page.waitForTimeout(1700);

    await expect(page.getByTestId("playground-feedback-trigger")).toBeVisible();
    await page.getByTestId("playground-feedback-trigger").click();
    await expect(page.getByTestId("playground-feedback-options")).toBeVisible();
    await expect(page.getByText("The tone")).toBeVisible();
    await expect(page.getByText("The word choices")).toBeVisible();
    await expect(page.getByText("The structure")).toBeVisible();
  });

  test("zero captures state shows all three paths in conversation flow", async ({ page }) => {
    await enableE2EAuth(page);
    await mockPlaygroundBootstrap(page, {
      generateResponse: {
        generic_output: null,
        voiced_output: null,
        confidence_context: null,
        zero_captures_state: true,
        onboarding_paths: {
          upload: {
            label: "Bring me something you already wrote. I can start there.",
            route: "/app/mirror/settings",
          },
          extension: {
            label: "Turn on the extension and let me watch you work in the wild.",
            route: "/app/mirror/settings",
          },
          conversation: {
            label: "Stay here and talk. Give me real language, not placeholders, and I will start learning immediately.",
          },
        },
      },
    });

    await openReadyPlayground(page);
    await triggerGeneration(page);

    await expect(page.getByTestId("playground-path-upload")).toBeVisible();
    await expect(page.getByTestId("playground-path-extension")).toBeVisible();
    await expect(page.getByTestId("playground-path-conversation")).toBeVisible();
  });

  test("playground link present in Mirror Mode navigation", async ({ page }) => {
    await enableE2EAuth(page);
    await mockPlaygroundBootstrap(page);

    await openReadyPlayground(page);

    await expect(page.getByTestId("mirror-nav-playground")).toBeVisible();
  });
});
