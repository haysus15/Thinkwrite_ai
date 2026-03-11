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
  if (!ext?.storage?.local) return {};
  try {
    return await callMaybePromise(
      () => ext.storage.local.get(key),
      (resolve) => ext.storage.local.get(key, (value) => resolve(value || {}))
    );
  } catch (error) {
    if (isContextInvalidatedError(error)) {
      return {};
    }
    throw error;
  }
}
async function localSet(value) {
  if (!ext?.storage?.local) return;
  try {
    await callMaybePromise(
      () => ext.storage.local.set(value),
      (resolve) => ext.storage.local.set(value, () => resolve(void 0))
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
  if (!ext?.runtime?.sendMessage) {
    throw new Error("Extension runtime sendMessage API unavailable");
  }
  return await new Promise((resolve, reject) => {
    try {
      ext.runtime.sendMessage(payload, (response) => {
        const lastError = ext?.runtime?.lastError;
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
async function render() {
  const app = document.getElementById("app");
  if (!app) return;
  const hostname = await getActiveHostname();
  const assignment = await getDomainAssignment(hostname);
  const globalPaused = await getGlobalPause();
  const stats = await getSessionStats();
  app.innerHTML = `
    <section class="panel">
      <h1>ThinkWrite Mirror Mode</h1>
      <div class="row"><span class="small">${globalPaused ? "Mirror Mode is paused" : "Mirror Mode is active"}</span></div>
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
  const globalBtn = app.querySelector("#toggle-global");
  globalBtn?.addEventListener("click", async () => {
    await setGlobalPause(!globalPaused);
    await render();
  });
  const domainBtn = app.querySelector("#toggle-domain");
  domainBtn?.addEventListener("click", async () => {
    if (assignment.isPaused) {
      await resumeDomain(hostname);
    } else {
      await pauseDomain(hostname);
    }
    await render();
  });
}
void render();
//# sourceMappingURL=popup.js.map
