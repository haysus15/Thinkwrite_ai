import { getAuthState } from "../lib/auth";
import { getDomainAssignment } from "../lib/domainMap";
import type { VoiceFingerprint } from "../lib/extractor";
import { runtimeOnMessageAddListener } from "../lib/runtime";

type SessionStats = {
  capturedCount: number;
  sessionStartedAt: string;
  lastCapturedAt: string | null;
  domainBreakdown: Record<string, number>;
};

const stats: SessionStats = {
  capturedCount: 0,
  sessionStartedAt: new Date().toISOString(),
  lastCapturedAt: null,
  domainBreakdown: {},
};

type FingerprintMessage = {
  type: "VOICE_FINGERPRINT";
  fingerprint: VoiceFingerprint;
  url: string;
};

function getSessionStats(): SessionStats {
  return {
    capturedCount: stats.capturedCount,
    sessionStartedAt: stats.sessionStartedAt,
    lastCapturedAt: stats.lastCapturedAt,
    domainBreakdown: { ...stats.domainBreakdown },
  };
}

async function handleFingerprint(fingerprint: VoiceFingerprint, hostname: string): Promise<void> {
  const auth = await getAuthState();
  if (!auth.isAuthenticated || !auth.accessToken) {
    console.warn("[ThinkWrite BG] dropping fingerprint due to missing auth");
    return;
  }

  try {
    const assignment = await getDomainAssignment(hostname);
    const payload: VoiceFingerprint = {
      ...fingerprint,
      chamber: assignment.chamber,
    };

    const endpoint = `${auth.apiBase}/api/mirror-mode/extension/fingerprint`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        "Content-Type": "application/json",
        "x-extension-hostname": hostname,
      },
      body: JSON.stringify(payload),
    });
    await response.text().catch(() => "");

    if (!response.ok) {
      console.warn("[ThinkWrite Extension] Fingerprint send failed", response.status);
      return;
    }

    stats.capturedCount += 1;
    stats.lastCapturedAt = new Date().toISOString();
    stats.domainBreakdown[hostname] = (stats.domainBreakdown[hostname] || 0) + 1;
  } catch (error) {
    console.warn("[ThinkWrite Extension] Fingerprint send error", error);
  }
}

runtimeOnMessageAddListener((message: FingerprintMessage | { type: "GET_SESSION_STATS" }, _sender: unknown, sendResponse: (value: unknown) => void) => {
  if (message.type === "VOICE_FINGERPRINT") {
    handleFingerprint(message.fingerprint, message.url)
      .then(() => sendResponse({ success: true }))
      .catch((err) => {
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
