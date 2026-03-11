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
    runtimeSendMessage<SessionStats>({ type: "GET_SESSION_STATS" }).then((response) => {
      resolve(
        response || {
          capturedCount: 0,
          sessionStartedAt: new Date().toISOString(),
          lastCapturedAt: null,
          domainBreakdown: {},
        }
      );
    });
  });
}

async function render(): Promise<void> {
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

  const globalBtn = app.querySelector<HTMLButtonElement>("#toggle-global");
  globalBtn?.addEventListener("click", async () => {
    await setGlobalPause(!globalPaused);
    await render();
  });

  const domainBtn = app.querySelector<HTMLButtonElement>("#toggle-domain");
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
