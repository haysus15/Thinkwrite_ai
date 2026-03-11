import { expect, test } from "playwright/test";

test.describe("capture-log API contracts", () => {
  test("returns 401 when unauthenticated", async ({ request }) => {
    const response = await request.get("/api/mirror-mode/capture-log?days=7");
    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body?.success).toBe(false);
    expect(typeof body?.error).toBe("string");
  });

  test("returns 401 with invalid filters when unauthenticated", async ({ request }) => {
    const response = await request.get(
      "/api/mirror-mode/capture-log?days=999&source=not-real&chamber=not-real"
    );
    // Auth gate runs first by design.
    expect(response.status()).toBe(401);
  });
});
