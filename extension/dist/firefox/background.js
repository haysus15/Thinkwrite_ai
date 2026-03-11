// lib/auth.ts
var THINKWRITE_API_BASE = true ? "http://localhost:3000" : "https://thinkwrite.ai";
function parseAuthCookie(rawValue) {
  try {
    const stripped = rawValue.startsWith("base64-") ? rawValue.slice("base64-".length) : rawValue;
    let jsonString;
    try {
      jsonString = atob(stripped);
    } catch {
      try {
        jsonString = decodeURIComponent(stripped);
      } catch {
        jsonString = stripped;
      }
    }
    const parsed = JSON.parse(jsonString);
    const data = Array.isArray(parsed) ? parsed[0] : parsed;
    if (!data || typeof data === "string") {
      return { accessToken: null, userId: null };
    }
    return {
      accessToken: data.access_token || null,
      userId: data.user?.id || null
    };
  } catch {
    return { accessToken: null, userId: null };
  }
}
async function getAuthState() {
  return await new Promise((resolve) => {
    chrome.cookies.getAll({}, (cookies) => {
      const baseCookie = cookies.find(
        (cookie) => /^sb-.+-auth-token$/.test(cookie.name) && !cookie.name.includes("code-verifier")
      );
      if (!baseCookie) {
        resolve({
          accessToken: null,
          userId: null,
          isAuthenticated: false,
          apiBase: THINKWRITE_API_BASE,
          cookieName: null,
          cookieDomain: null
        });
        return;
      }
      const baseName = baseCookie.name;
      const chunks = cookies.filter((cookie) => cookie.name.startsWith(`${baseName}.`)).sort((a, b) => a.name.localeCompare(b.name));
      const rawValue = chunks.length > 0 ? chunks.map((cookie) => cookie.value).join("") : baseCookie.value;
      const result = parseAuthCookie(rawValue);
      resolve({
        accessToken: result.accessToken,
        userId: result.userId,
        isAuthenticated: Boolean(result.accessToken && result.userId),
        apiBase: THINKWRITE_API_BASE,
        cookieName: baseCookie.name,
        cookieDomain: baseCookie.domain || null
      });
    });
  });
}

// lib/runtime.ts
function hasThen(value) {
  return Boolean(value) && typeof value.then === "function";
}
function isContextInvalidatedError(error) {
  if (!error || typeof error !== "object") return false;
  const message = "message" in error && typeof error.message === "string" ? error.message : "";
  return message.toLowerCase().includes("context invalidated");
}
async function callMaybePromise(call, callbackStyle) {
  try {
    const result = call();
    if (hasThen(result)) {
      return await result;
    }
    if (callbackStyle) {
      return await new Promise((resolve) => callbackStyle(resolve));
    }
    return result;
  } catch {
    if (callbackStyle) {
      return await new Promise((resolve) => callbackStyle(resolve));
    }
    throw new Error("Extension API unavailable");
  }
}
var ext = globalThis.chrome ?? globalThis.browser ?? null;
async function syncGet(key) {
  if (!ext?.storage?.sync) return {};
  try {
    return await callMaybePromise(
      () => ext.storage.sync.get(key),
      (resolve) => ext.storage.sync.get(key, (value) => resolve(value || {}))
    );
  } catch (error) {
    if (isContextInvalidatedError(error)) {
      return {};
    }
    throw error;
  }
}
function runtimeOnMessageAddListener(listener) {
  if (!ext?.runtime?.onMessage?.addListener) return;
  ext.runtime.onMessage.addListener(listener);
}

// lib/domainMap.ts
var STORAGE_KEY = "domainAssignments";
var defaultAssignment = () => ({
  chamber: "general",
  assignedAt: (/* @__PURE__ */ new Date()).toISOString(),
  isPaused: false
});
async function readMap() {
  const stored = await syncGet(STORAGE_KEY);
  const map = stored[STORAGE_KEY];
  if (!map || typeof map !== "object") {
    return {};
  }
  return map;
}
async function getDomainAssignment(hostname) {
  const map = await readMap();
  const assignment = map[hostname];
  if (!assignment) return defaultAssignment();
  return {
    chamber: assignment.chamber || "general",
    assignedAt: assignment.assignedAt || (/* @__PURE__ */ new Date()).toISOString(),
    isPaused: Boolean(assignment.isPaused)
  };
}

// src/background.ts
var stats = {
  capturedCount: 0,
  sessionStartedAt: (/* @__PURE__ */ new Date()).toISOString(),
  lastCapturedAt: null,
  domainBreakdown: {}
};
function getSessionStats() {
  return {
    capturedCount: stats.capturedCount,
    sessionStartedAt: stats.sessionStartedAt,
    lastCapturedAt: stats.lastCapturedAt,
    domainBreakdown: { ...stats.domainBreakdown }
  };
}
async function handleFingerprint(fingerprint, hostname) {
  const auth = await getAuthState();
  if (!auth.isAuthenticated || !auth.accessToken) {
    console.warn("[ThinkWrite BG] dropping fingerprint due to missing auth");
    return;
  }
  try {
    const assignment = await getDomainAssignment(hostname);
    const payload = {
      ...fingerprint,
      chamber: assignment.chamber
    };
    const endpoint = `${auth.apiBase}/api/mirror-mode/extension/fingerprint`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        "Content-Type": "application/json",
        "x-extension-hostname": hostname
      },
      body: JSON.stringify(payload)
    });
    await response.text().catch(() => "");
    if (!response.ok) {
      console.warn("[ThinkWrite Extension] Fingerprint send failed", response.status);
      return;
    }
    stats.capturedCount += 1;
    stats.lastCapturedAt = (/* @__PURE__ */ new Date()).toISOString();
    stats.domainBreakdown[hostname] = (stats.domainBreakdown[hostname] || 0) + 1;
  } catch (error) {
    console.warn("[ThinkWrite Extension] Fingerprint send error", error);
  }
}
runtimeOnMessageAddListener((message, _sender, sendResponse) => {
  if (message.type === "VOICE_FINGERPRINT") {
    handleFingerprint(message.fingerprint, message.url).then(() => sendResponse({ success: true })).catch((err) => {
      console.warn("[ThinkWrite BG] fingerprint send failed:", err);
      sendResponse({ success: false, error: String(err?.message || err) });
    });
    return true;
  }
  if (message.type === "GET_SESSION_STATS") {
    sendResponse(getSessionStats());
    return true;
  }
  return true;
});
//# sourceMappingURL=background.js.map
