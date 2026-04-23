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
async function syncSet(value) {
  if (!ext?.storage?.sync) return;
  try {
    await callMaybePromise(
      () => ext.storage.sync.set(value),
      (resolve) => ext.storage.sync.set(value, () => resolve(void 0))
    );
  } catch (error) {
    if (!isContextInvalidatedError(error)) {
      throw error;
    }
  }
}
async function tabsQuery(query) {
  if (!ext?.tabs) return [];
  try {
    return await callMaybePromise(
      () => ext.tabs.query(query),
      (resolve) => ext.tabs.query(query, (tabs) => resolve(tabs || []))
    );
  } catch (error) {
    if (isContextInvalidatedError(error)) {
      return [];
    }
    throw error;
  }
}
async function runtimeSendMessage(payload) {
  const runtime = (globalThis.chrome ?? globalThis.browser)?.runtime;
  if (!runtime?.sendMessage) {
    throw new Error("Extension runtime sendMessage API unavailable");
  }
  return await new Promise((resolve, reject) => {
    try {
      runtime.sendMessage(payload, (response) => {
        const lastError = runtime.lastError;
        if (lastError) {
          reject(new Error(lastError.message || "Unknown runtime sendMessage error"));
          return;
        }
        resolve(response || null);
      });
    } catch {
      reject(new Error("Failed to send extension runtime message"));
    }
  });
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
async function loginWithCredentials(email, password) {
  const data = await postExtensionAuth("/api/extension/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  if (!data.session) {
    throw new Error("Extension session was not returned");
  }
  await storeSession(data.session);
  return getAuthState();
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
async function writeMap(map) {
  await syncSet({ [STORAGE_KEY]: map });
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
async function setDomainAssignment(hostname, chamber) {
  const map = await readMap();
  const prev = map[hostname];
  map[hostname] = {
    chamber,
    assignedAt: prev?.assignedAt || (/* @__PURE__ */ new Date()).toISOString(),
    isPaused: prev?.isPaused || false
  };
  await writeMap(map);
}
async function pauseDomain(hostname) {
  const map = await readMap();
  const prev = map[hostname] || defaultAssignment();
  map[hostname] = {
    ...prev,
    isPaused: true
  };
  await writeMap(map);
  await localSet({ [`paused:${hostname}`]: true });
}
async function resumeDomain(hostname) {
  const map = await readMap();
  const prev = map[hostname] || defaultAssignment();
  map[hostname] = {
    ...prev,
    isPaused: false
  };
  await writeMap(map);
  await localSet({ [`paused:${hostname}`]: false });
}

// src/popup/popup.ts
function minutesSince(iso) {
  const delta = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.floor(delta / 6e4));
  return `${mins} minute${mins === 1 ? "" : "s"} ago`;
}
async function getActiveHostname() {
  const tabs = await tabsQuery({ active: true, currentWindow: true });
  const url = tabs[0]?.url || "";
  try {
    return new URL(url).hostname || "unknown";
  } catch {
    return "unknown";
  }
}
async function getGlobalPause() {
  const state = await localGet("isPaused");
  return Boolean(state.isPaused);
}
async function setGlobalPause(value) {
  await localSet({ isPaused: value });
}
async function getSessionStats() {
  return new Promise((resolve) => {
    runtimeSendMessage({ type: "GET_SESSION_STATS" }).then((response) => {
      resolve(
        response || {
          capturedCount: 0,
          sessionStartedAt: (/* @__PURE__ */ new Date()).toISOString(),
          lastCapturedAt: null,
          domainBreakdown: {}
        }
      );
    });
  });
}
function renderAuthShell(title, body) {
  return `
    <section class="panel">
      <h1>Mirror Mode</h1>
      <div class="small">${title}</div>
      <div style="height:12px"></div>
      ${body}
    </section>
  `;
}
async function renderLogin(app, errorMessage) {
  app.innerHTML = renderAuthShell(
    "Sign in to reconnect the extension to your Mirror Mode account.",
    `
      <form id="login-form">
        <div class="row"><input id="email" type="email" placeholder="Email" required /></div>
        <div class="row"><input id="password" type="password" placeholder="Password" required /></div>
        ${errorMessage ? `<div class="small" style="color:#fca5a5">${errorMessage}</div>` : ""}
        <div style="height:8px"></div>
        <button type="submit">Sign in</button>
      </form>
    `
  );
  const form = app.querySelector("#login-form");
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = app.querySelector("#email")?.value?.trim() || "";
    const password = app.querySelector("#password")?.value || "";
    try {
      await loginWithCredentials(email, password);
      const stored = await chrome.storage.local.get("mirrormode_ext_session");
      console.log("[MirrorMode Popup] session after login:", JSON.stringify(stored));
      await render();
    } catch (error) {
      await renderLogin(
        app,
        error instanceof Error ? error.message : "Could not sign in to Mirror Mode."
      );
    }
  });
}
async function renderReconnect(app) {
  app.innerHTML = renderAuthShell(
    "Your extension session expired.",
    `
      <div class="small">Reconnect to resume Mirror Mode collection.</div>
      <div style="height:12px"></div>
      <button id="reconnect">Reconnect</button>
      <div style="height:8px"></div>
      <button id="logout">Clear session</button>
    `
  );
  app.querySelector("#reconnect")?.addEventListener("click", async () => {
    const auth = await refreshSession();
    if (auth?.isAuthenticated) {
      await render();
      return;
    }
    await renderLogin(app, "Reconnect failed. Sign in again.");
  });
  app.querySelector("#logout")?.addEventListener("click", async () => {
    await clearSession();
    await render();
  });
}
async function renderAuthenticated(app) {
  const hostname = await getActiveHostname();
  const assignment = await getDomainAssignment(hostname);
  const globalPaused = await getGlobalPause();
  const stats = await getSessionStats();
  const auth = await getAuthState();
  app.innerHTML = `
    <section class="panel">
      <h1>Mirror Mode</h1>
      <div class="row"><span class="small">${globalPaused ? "Mirror Mode is paused" : "Mirror Mode is active"}</span></div>
      <div class="small">${auth.email || "Connected"}</div>
      <button id="toggle-global">${globalPaused ? "Resume collection" : "Pause collection"}</button>

      <h2>This site</h2>
      <div class="small">${hostname}</div>
      <div class="row">
        <label class="small" for="chamber">Chamber</label>
      </div>
      <select id="chamber">
        <option value="general" ${assignment.chamber === "general" ? "selected" : ""}>General</option>
        <option value="career" ${assignment.chamber === "career" ? "selected" : ""}>Career</option>
        <option value="academic" ${assignment.chamber === "academic" ? "selected" : ""}>Academic</option>
        <option value="creative" ${assignment.chamber === "creative" ? "selected" : ""}>Creative</option>
      </select>
      <div style="height:8px"></div>
      <button id="toggle-domain">${assignment.isPaused ? "Resume on this site" : "Pause on this site"}</button>

      <h2>This session</h2>
      <div class="small">${stats.capturedCount} samples captured</div>
      <div class="small">Started ${minutesSince(stats.sessionStartedAt)}</div>
      <div class="list" id="breakdown"></div>
      <div style="height:8px"></div>
      <button id="logout">Disconnect extension</button>
    </section>
  `;
  const breakdown = app.querySelector("#breakdown");
  if (breakdown) {
    const entries = Object.entries(stats.domainBreakdown).sort((a, b) => b[1] - a[1]);
    breakdown.innerHTML = entries.map(([host, count]) => `<div class="listRow"><span>${host}</span><span>${count}</span></div>`).join("");
  }
  const chamberSelect = app.querySelector("#chamber");
  chamberSelect?.addEventListener("change", async () => {
    const chamber = chamberSelect.value || "general";
    await setDomainAssignment(hostname, chamber);
  });
  app.querySelector("#toggle-global")?.addEventListener("click", async () => {
    await setGlobalPause(!globalPaused);
    await render();
  });
  app.querySelector("#toggle-domain")?.addEventListener("click", async () => {
    if (assignment.isPaused) {
      await resumeDomain(hostname);
    } else {
      await pauseDomain(hostname);
    }
    await render();
  });
  app.querySelector("#logout")?.addEventListener("click", async () => {
    await clearSession();
    await render();
  });
}
async function render() {
  const app = document.getElementById("app");
  if (!app) return;
  const auth = await getAuthState();
  if (!auth.accessToken) {
    await renderLogin(app);
    return;
  }
  if (auth.needsReconnect) {
    await renderReconnect(app);
    return;
  }
  await renderAuthenticated(app);
}
void render();
//# sourceMappingURL=popup.js.map
