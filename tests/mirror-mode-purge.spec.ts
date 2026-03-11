import { expect, test } from "playwright/test";

test.describe("mirror-mode purge API contracts", () => {
  test("returns 401 when unauthenticated", async ({ request }) => {
    const response = await request.post("/api/mirror-mode/purge", {
      data: {
        purge_mode: "strict",
        confirmation: "PURGE",
      },
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(typeof body?.error).toBe("string");
  });
});

