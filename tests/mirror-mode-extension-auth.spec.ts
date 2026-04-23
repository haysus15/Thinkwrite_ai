import { expect, test } from "playwright/test";
import { NextRequest } from "next/server.js";
import { POST as refreshExtensionSession } from "@/app/api/extension/auth/refresh/route";
import { createExtensionSessionToken } from "@/app/api/extension/auth/route";

test.describe("mirror-mode extension auth", () => {
  test("request with valid token succeeds", async () => {
    const previousSecret = process.env.EXTENSION_SESSION_SECRET;
    process.env.EXTENSION_SESSION_SECRET = "test-extension-secret";
    try {
      const session = createExtensionSessionToken({
        userId: "user-1",
        email: "writer@example.com",
      });

      const request = new NextRequest("http://localhost:3000/api/extension/auth/refresh", {
        method: "POST",
        headers: {
          authorization: `Bearer ${session.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const response = await refreshExtensionSession(request);

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        success: true,
        session: {
          userId: "user-1",
          email: "writer@example.com",
          source: "extension",
        },
      });
    } finally {
      process.env.EXTENSION_SESSION_SECRET = previousSecret;
    }
  });

  test("request with expired token returns 401", async () => {
    const previousSecret = process.env.EXTENSION_SESSION_SECRET;
    process.env.EXTENSION_SESSION_SECRET = "test-extension-secret";
    try {
      const session = createExtensionSessionToken({
        userId: "user-1",
        email: "writer@example.com",
        now: Date.now() - 9 * 24 * 60 * 60 * 1000,
      });

      const request = new NextRequest("http://localhost:3000/api/extension/auth/refresh", {
        method: "POST",
        headers: {
          authorization: `Bearer ${session.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const response = await refreshExtensionSession(request);

      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toMatchObject({
        success: false,
        error: "Extension session is invalid or expired",
      });
    } finally {
      process.env.EXTENSION_SESSION_SECRET = previousSecret;
    }
  });

  test("request with no token returns 401", async () => {
    const request = new NextRequest("http://localhost:3000/api/extension/auth/refresh", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    const response = await refreshExtensionSession(request);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: "Extension session token is required",
    });
  });

  test("token must come from chrome.storage.local, not cookies", async () => {
    let localGetCalls = 0;
    let cookiesGetAllCalls = 0;

    (globalThis as unknown as { chrome: unknown }).chrome = {
      runtime: {},
      storage: {
        local: {
          get: (_key: string, callback: (value: Record<string, unknown>) => void) => {
            localGetCalls += 1;
            callback({
              thinkwrite_ext_session: {
                token: "stored-token",
                userId: "user-1",
                email: "writer@example.com",
                source: "extension",
                expiresAt: new Date(Date.now() + 60_000).toISOString(),
              },
            });
          },
        },
      },
      cookies: {
        getAll: () => {
          cookiesGetAllCalls += 1;
          throw new Error("cookies should not be used");
        },
      },
    };

    const authModule = await import("../extension/lib/auth");
    const state = await authModule.getAuthState();

    expect(state.isAuthenticated).toBe(true);
    expect(state.accessToken).toBe("stored-token");
    expect(localGetCalls).toBeGreaterThan(0);
    expect(cookiesGetAllCalls).toBe(0);

    delete (globalThis as unknown as { chrome?: unknown }).chrome;
  });
});
