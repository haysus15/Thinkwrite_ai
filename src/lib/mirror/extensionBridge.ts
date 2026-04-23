"use client";

const REQUEST_SOURCE = "thinkwrite-mirror-page";
const RESPONSE_SOURCE = "thinkwrite-mirror-extension";
const FALLBACK_STORAGE_KEY = "tw-mirror-capture-enabled";

type BridgeAction = "get_capture_enabled" | "set_capture_enabled";

type BridgeRequest = {
  source: typeof REQUEST_SOURCE;
  requestId: string;
  action: BridgeAction;
  value?: boolean;
};

type BridgeResponse = {
  source: typeof RESPONSE_SOURCE;
  requestId: string;
  ok: boolean;
  value?: boolean;
  error?: string;
};

function canUseWindow(): boolean {
  return typeof window !== "undefined";
}

function fallbackGetCaptureEnabled(): boolean {
  if (!canUseWindow()) return true;
  const raw = window.localStorage.getItem(FALLBACK_STORAGE_KEY);
  if (raw === null) return true;
  return raw !== "0";
}

function fallbackSetCaptureEnabled(value: boolean): void {
  if (!canUseWindow()) return;
  window.localStorage.setItem(FALLBACK_STORAGE_KEY, value ? "1" : "0");
}

async function callBridge(action: BridgeAction, value?: boolean): Promise<boolean | null> {
  if (!canUseWindow()) return null;

  const requestId = `mirror-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  return await new Promise<boolean | null>((resolve) => {
    let settled = false;

    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timeoutId);
    };

    const finish = (next: boolean | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(next);
    };

    const onMessage = (event: MessageEvent) => {
      const data = event.data as BridgeResponse | undefined;
      if (!data || data.source !== RESPONSE_SOURCE || data.requestId !== requestId) {
        return;
      }
      finish(data.ok ? (typeof data.value === "boolean" ? data.value : null) : null);
    };

    const timeoutId = window.setTimeout(() => finish(null), 250);
    window.addEventListener("message", onMessage);

    const payload: BridgeRequest = {
      source: REQUEST_SOURCE,
      requestId,
      action,
      value,
    };

    window.postMessage(payload, window.location.origin);
  });
}

export async function getCaptureEnabled(): Promise<boolean> {
  const bridged = await callBridge("get_capture_enabled");
  if (typeof bridged === "boolean") {
    fallbackSetCaptureEnabled(bridged);
    return bridged;
  }
  return fallbackGetCaptureEnabled();
}

export async function setCaptureEnabled(value: boolean): Promise<boolean> {
  const bridged = await callBridge("set_capture_enabled", value);
  if (typeof bridged === "boolean") {
    fallbackSetCaptureEnabled(bridged);
    return bridged;
  }
  fallbackSetCaptureEnabled(value);
  return value;
}
