import {
  clearSession,
  getAuthState,
  loginWithCredentials,
  refreshSession,
} from "../../lib/auth";
import {
  getDomainAssignment,
  pauseDomain,
  resumeDomain,
  setDomainAssignment,
  type Chamber,
} from "../../lib/domainMap";
import { localGet, localSet, runtimeSendMessage, tabsQuery } from "../../lib/runtime";

type SessionStats = {
  capturedCount: number;
  sessionStartedAt: string;
  lastCapturedAt: string | null;
  domainBreakdown: Record<string, number>;
};

function minutesSince(iso: string): string {
  const delta = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.floor(delta / 60000));
  return `${mins} minute${mins === 1 ? "" : "s"} ago`;
}

async function getActiveHostname(): Promise<string> {
  const tabs = await tabsQuery({ active: true, currentWindow: true });
  const url = tabs[0]?.url || "";
  try {
    return new URL(url).hostname || "unknown";
  } catch {
    return "unknown";
  }
}

async function getGlobalPause(): Promise<boolean> {
  const state = await localGet<Record<string, unknown>>("isPaused");
  return Boolean(state.isPaused);
}

async function setGlobalPause(value: boolean): Promise<void> {
  await localSet({ isPaused: value });
}

async function getSessionStats(): Promise<SessionStats> {
  return new Promise((resolve) => {
    runtimeSendMessage({ type: "GET_SESSION_STATS" }).then((response) => {
      resolve(
        (response as SessionStats) || {
          capturedCount: 0,
          sessionStartedAt: new Date().toISOString(),
          lastCapturedAt: null,
          domainBreakdown: {},
        }
      );
    });
  });
}

function renderAuthShell(title: string, body: string): string {
  return `
    <section class="panel">
      <h1>Mirror Mode</h1>
      <div class="small">${title}</div>
      <div style="height:12px"></div>
      ${body}
    </section>
  `;
}

async function renderLogin(app: HTMLElement, errorMessage?: string): Promise<void> {
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

  const form = app.querySelector<HTMLFormElement>("#login-form");
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = app.querySelector<HTMLInputElement>("#email")?.value?.trim() || "";
    const password = app.querySelector<HTMLInputElement>("#password")?.value || "";

    try {
      await loginWithCredentials(email, password);
      // Debug: verify session was stored
      const stored = await chrome.storage.local.get('mirrormode_ext_session');
      console.log('[MirrorMode Popup] session after login:', JSON.stringify(stored));
      await render();
    } catch (error) {
      await renderLogin(
        app,
        error instanceof Error ? error.message : "Could not sign in to Mirror Mode."
      );
    }
  });
}

async function renderReconnect(app: HTMLElement): Promise<void> {
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

  app.querySelector<HTMLButtonElement>("#reconnect")?.addEventListener("click", async () => {
    const auth = await refreshSession();
    if (auth?.isAuthenticated) {
      await render();
      return;
    }
    await renderLogin(app, "Reconnect failed. Sign in again.");
  });

  app.querySelector<HTMLButtonElement>("#logout")?.addEventListener("click", async () => {
    await clearSession();
    await render();
  });
}

async function renderAuthenticated(app: HTMLElement): Promise<void> {
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

  const breakdown = app.querySelector<HTMLDivElement>("#breakdown");
  if (breakdown) {
    const entries = Object.entries(stats.domainBreakdown).sort((a, b) => b[1] - a[1]);
    breakdown.innerHTML = entries
      .map(([host, count]) => `<div class="listRow"><span>${host}</span><span>${count}</span></div>`)
      .join("");
  }

  const chamberSelect = app.querySelector<HTMLSelectElement>("#chamber");
  chamberSelect?.addEventListener("change", async () => {
    const chamber = (chamberSelect.value as Chamber) || "general";
    await setDomainAssignment(hostname, chamber);
  });

  app.querySelector<HTMLButtonElement>("#toggle-global")?.addEventListener("click", async () => {
    await setGlobalPause(!globalPaused);
    await render();
  });

  app.querySelector<HTMLButtonElement>("#toggle-domain")?.addEventListener("click", async () => {
    if (assignment.isPaused) {
      await resumeDomain(hostname);
    } else {
      await pauseDomain(hostname);
    }
    await render();
  });

  app.querySelector<HTMLButtonElement>("#logout")?.addEventListener("click", async () => {
    await clearSession();
    await render();
  });
}

async function render(): Promise<void> {
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
