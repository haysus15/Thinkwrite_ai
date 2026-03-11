import { test, expect } from "playwright/test";

test.describe("Mirror Mode API contracts", () => {
  test("live-learn feed requires auth", async ({ request }) => {
    const response = await request.get("/api/mirror-mode/live-learn");
    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body?.success).toBe(false);
  });

  test("live-learn accepts POST route shape (no 405)", async ({ request }) => {
    const response = await request.post("/api/mirror-mode/live-learn", {
      data: {
        text: "Sample text to verify POST contract.",
        source: "other",
        sourceAuthority: "unknown",
      },
    });

    // Contract check: endpoint exists as POST and is auth-gated.
    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body?.success).toBe(false);
  });

  test("capture-log requires auth", async ({ request }) => {
    const response = await request.get("/api/mirror-mode/capture-log?days=7");
    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body?.success).toBe(false);
  });
});
