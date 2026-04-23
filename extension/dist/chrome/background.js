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
async function localGet(key) {
  const storage = (globalThis.chrome ?? globalThis.browser)?.storage?.local;
  if (!storage) {
    console.warn("[MirrorMode] storage.local not available at localGet call time");
    return {};
  }
  return new Promise((resolve) => {
    storage.get(key, (result) => resolve(result || {}));
  });
}
async function localSet(value) {
  const storage = (globalThis.chrome ?? globalThis.browser)?.storage?.local;
  if (!storage) {
    console.warn("[MirrorMode] storage.local not available at localSet call time");
    return;
  }
  return new Promise((resolve) => {
    storage.set(value, () => resolve());
  });
}
async function localRemove(key) {
  if (!ext?.storage?.local) return;
  try {
    await callMaybePromise(
      () => ext.storage.local.remove(key),
      (resolve) => ext.storage.local.remove(key, () => resolve(void 0))
    );
  } catch (error) {
    if (!isContextInvalidatedError(error)) {
      throw error;
    }
  }
}
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

// lib/auth.ts
var THINKWRITE_API_BASE = true ? "http://localhost:3000" : "https://mirrormode.ai";
var EXTENSION_SESSION_STORAGE_KEY = "mirrormode_ext_session";
function isStoredSession(value) {
  return Boolean(value) && typeof value === "object" && typeof value.token === "string";
}
function isExpired(expiresAt) {
  if (!expiresAt) return true;
  const timestamp = Date.parse(expiresAt);
  if (Number.isNaN(timestamp)) return true;
  return Date.now() >= timestamp;
}
async function getStoredSession() {
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    return new Promise((resolve) => {
      chrome.storage.local.get(EXTENSION_SESSION_STORAGE_KEY, (result) => {
        resolve(result || {});
      });
    });
  }
  return localGet(EXTENSION_SESSION_STORAGE_KEY);
}
async function readStoredSession() {
  const stored = await getStoredSession();
  const session = stored[EXTENSION_SESSION_STORAGE_KEY];
  return isStoredSession(session) ? session : null;
}
async function storeSession(session) {
  await localSet({ [EXTENSION_SESSION_STORAGE_KEY]: session });
}
async function clearSession() {
  await localRemove(EXTENSION_SESSION_STORAGE_KEY);
}
async function getAuthState() {
  const session = await readStoredSession();
  const expired = isExpired(session?.expiresAt);
  return {
    accessToken: session?.token ?? null,
    userId: session?.userId ?? null,
    email: session?.email ?? null,
    isAuthenticated: Boolean(session?.token && session?.userId && !expired),
    isExpired: Boolean(session?.token && expired),
    needsReconnect: Boolean(session?.token && expired),
    expiresAt: session?.expiresAt ?? null,
    apiBase: THINKWRITE_API_BASE
  };
}
async function postExtensionAuth(path, init) {
  const response = await fetch(`${THINKWRITE_API_BASE}${path}`, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || "Extension authentication request failed");
  }
  return data;
}
async function refreshSession() {
  const session = await readStoredSession();
  if (!session?.token) {
    return null;
  }
  try {
    const data = await postExtensionAuth(
      "/api/extension/auth/refresh",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.token}`,
          "Content-Type": "application/json"
        }
      }
    );
    if (!data.session) {
      await clearSession();
      return null;
    }
    await storeSession(data.session);
    return getAuthState();
  } catch {
    await clearSession();
    return null;
  }
}
async function getValidAccessToken() {
  const auth = await getAuthState();
  if (auth.isAuthenticated && auth.accessToken) {
    return auth.accessToken;
  }
  if (!auth.isExpired) {
    return null;
  }
  const refreshed = await refreshSession();
  return refreshed?.isAuthenticated ? refreshed.accessToken : null;
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
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    console.warn("[MirrorMode BG] dropping fingerprint due to missing auth");
    return;
  }
  try {
    const assignment = await getDomainAssignment(hostname);
    const payload = {
      ...fingerprint,
      chamber: assignment.chamber
    };
    const endpoint = `${THINKWRITE_API_BASE}/api/mirror/extension/fingerprint`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "x-extension-hostname": hostname
      },
      body: JSON.stringify(payload)
    });
    await response.text().catch(() => "");
    console.log("[MirrorMode BG] fingerprint sent successfully, status:", response.status);
    if (response.status === 401) {
      await clearSession();
      console.warn("[MirrorMode Extension] Session expired; cleared stored token");
      return;
    }
    if (!response.ok) {
      console.warn("[MirrorMode Extension] Fingerprint send failed", response.status);
      return;
    }
    stats.capturedCount += 1;
    stats.lastCapturedAt = (/* @__PURE__ */ new Date()).toISOString();
    stats.domainBreakdown[hostname] = (stats.domainBreakdown[hostname] || 0) + 1;
  } catch (error) {
    console.warn("[MirrorMode Extension] Fingerprint send error", error);
  }
}
runtimeOnMessageAddListener((message, _sender, sendResponse) => {
  console.log("[MirrorMode BG] message received:", message.type);
  if (message.type === "VOICE_FINGERPRINT") {
    handleFingerprint(message.fingerprint, message.url).then(() => sendResponse({ success: true })).catch((err) => {
      console.warn("[MirrorMode BG] fingerprint send failed:", err);
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
