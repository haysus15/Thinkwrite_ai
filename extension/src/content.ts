import { TextBufferManager, createStableFieldId } from "../lib/buffer";
import { extractFingerprint, type Chamber } from "../lib/extractor";
import { hasExtApi, localGet, localSet, runtimeSendMessage } from "../lib/runtime";

const TW_EXTENSION_BUILD = "0.1.2";

type QualifyingField = HTMLTextAreaElement | HTMLElement;

type FieldRuntime = {
  element: QualifyingField;
  fieldId: string;
  debounceTimer: number | null;
  listener: (event: Event) => void;
};

const SESSION_ID = typeof crypto !== "undefined" && "randomUUID" in crypto
  ? crypto.randomUUID()
  : `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const CAPTURE_ENABLED_KEY = "capture_enabled";
const REQUEST_SOURCE = "thinkwrite-mirror-page";
const RESPONSE_SOURCE = "thinkwrite-mirror-extension";

const fieldMap = new Map<HTMLElement, FieldRuntime>();
const runtimeById = new Map<string, FieldRuntime>();

function getHostname(): string {
  return window.location.hostname;
}

function isThinkWriteHost(hostname: string): boolean {
  return hostname === "mirrormode.ai" || hostname === "www.mirrormode.ai" || hostname === "localhost";
}

function isSearchField(element: HTMLElement): boolean {
  const type = element.getAttribute("type")?.toLowerCase();
  const role = element.getAttribute("role")?.toLowerCase();
  const ariaLabel = element.getAttribute("aria-label")?.toLowerCase() || "";

  if (type === "search") return true;
  if (role === "searchbox") return true;
  if (ariaLabel.includes("search")) return true;
  return false;
}

function isPasswordField(element: HTMLElement): boolean {
  const type = element.getAttribute("type")?.toLowerCase();
  return type === "password";
}

function isEditableField(element: HTMLElement): element is QualifyingField {
  const tag = element.tagName.toLowerCase();
  const role = element.getAttribute("role")?.toLowerCase();
  const contentEditable = element.getAttribute("contenteditable")?.toLowerCase();

  const qualifies =
    tag === "textarea" ||
    ((tag === "div" || tag === "article") && contentEditable === "true") ||
    role === "textbox";

  if (!qualifies) return false;
  if (isSearchField(element)) return false;
  if (isPasswordField(element)) return false;

  return true;
}

function readFieldText(field: QualifyingField): string {
  if (field instanceof HTMLTextAreaElement) {
    return field.value || "";
  }

  if (field instanceof HTMLInputElement) {
    return field.value || "";
  }

  return field.innerText || field.textContent || "";
}

async function isCollectionPaused(hostname: string): Promise<boolean> {
  try {
    const storage = (globalThis.chrome ?? (globalThis as any).browser)?.storage?.local;
    if (!storage) return false; // fail open — if storage unavailable, allow capture

    const result = await new Promise<Record<string, unknown>>((resolve) => {
      storage.get(['capture_enabled', 'isPaused', `paused:${hostname}`], (data: Record<string, unknown>) => {
        resolve(data || {});
      });
    });

    if (result['capture_enabled'] === false) return true;
    if (result['isPaused'] === true) return true;
    if (result[`paused:${hostname}`] === true) return true;
    return false;
  } catch {
    return false; // fail open
  }
}

function installMirrorSettingsBridge(): void {
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data as
      | {
          source?: string;
          requestId?: string;
          action?: "get_capture_enabled" | "set_capture_enabled";
          value?: boolean;
        }
      | undefined;

    if (!data || data.source !== REQUEST_SOURCE || typeof data.requestId !== "string") {
      return;
    }

    const reply = async () => {
      try {
        if (data.action === "get_capture_enabled") {
          const state = await localGet<Record<string, unknown>>(CAPTURE_ENABLED_KEY);
          const enabled = state[CAPTURE_ENABLED_KEY] !== false;
          window.postMessage(
            {
              source: RESPONSE_SOURCE,
              requestId: data.requestId,
              ok: true,
              value: enabled,
            },
            window.location.origin
          );
          return;
        }

        if (data.action === "set_capture_enabled" && typeof data.value === "boolean") {
          await localSet({ [CAPTURE_ENABLED_KEY]: data.value });
          window.postMessage(
            {
              source: RESPONSE_SOURCE,
              requestId: data.requestId,
              ok: true,
              value: data.value,
            },
            window.location.origin
          );
          return;
        }
      } catch (error) {
        window.postMessage(
          {
            source: RESPONSE_SOURCE,
            requestId: data.requestId,
            ok: false,
            error: error instanceof Error ? error.message : "Bridge error",
          },
          window.location.origin
        );
      }
    };

    void reply();
  });
}

const manager = new TextBufferManager((state) => {
  const runtime = runtimeById.get(state.fieldId);
  if (!runtime) return;
  void processField(runtime, "idle");
});

async function processField(runtime: FieldRuntime, mode: "input" | "idle"): Promise<void> {
  const hostname = getHostname();
  const paused = await isCollectionPaused(hostname);

  if (paused) return;

  const text = readFieldText(runtime.element);
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  const evaluation = manager.upsert(runtime.fieldId, text);

  if (mode === "input" && !evaluation.shouldExtract) {
    return;
  }

  if (mode === "idle" && evaluation.state.wordCount < 80) {
    return;
  }

  const fingerprint = extractFingerprint(evaluation.state.text, "general" satisfies Chamber, SESSION_ID);

  if (!fingerprint) {
    return;
  }

  manager.markExtracted(runtime.fieldId);

  // Retry up to 3 times with 500ms delay — service worker may need to wake up
  let sent = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await runtimeSendMessage({
        type: "VOICE_FINGERPRINT",
        fingerprint,
        url: hostname,
      });
      sent = true;
      break;
    } catch (err) {
      if (attempt < 2) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      } else {
        console.warn("[MirrorMode] sendMessage failed after 3 attempts:", err);
      }
    }
  }
}

function attachField(element: HTMLElement): void {
  if (fieldMap.has(element)) return;
  if (!isEditableField(element)) return;

  const fieldId = createStableFieldId(element);

  const runtime: FieldRuntime = {
    element,
    fieldId,
    debounceTimer: null,
    listener: () => {
      if (runtime.debounceTimer) {
        window.clearTimeout(runtime.debounceTimer);
      }

      runtime.debounceTimer = window.setTimeout(() => {
        void processField(runtime, "input");
      }, 500);
    },
  };

  element.addEventListener("input", runtime.listener, { passive: true });
  fieldMap.set(element, runtime);
  runtimeById.set(fieldId, runtime);
}

function detachRemovedFields(): void {
  for (const [element, runtime] of fieldMap.entries()) {
    if (document.contains(element)) continue;

    element.removeEventListener("input", runtime.listener);
    if (runtime.debounceTimer) {
      window.clearTimeout(runtime.debounceTimer);
    }
    manager.clear(runtime.fieldId);
    runtimeById.delete(runtime.fieldId);
    fieldMap.delete(element);
  }
}

function scan(): void {
  const candidates = document.querySelectorAll<HTMLElement>(
    "textarea, div[contenteditable='true'], article[contenteditable='true'], [role='textbox']"
  );
  candidates.forEach((candidate) => attachField(candidate));
  detachRemovedFields();
}

function shouldRunOnThisFrame(): boolean {
  if (window.top === window.self) return true;
  try {
    return window.parent.location.hostname === window.location.hostname;
  } catch {
    return false;
  }
}

if (hasExtApi() && shouldRunOnThisFrame()) {
  installMirrorSettingsBridge();

  if (!isThinkWriteHost(getHostname())) {
    scan();
  }

  const observer = new MutationObserver(() => {
    if (!isThinkWriteHost(getHostname())) {
      scan();
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  window.addEventListener("pagehide", () => {
    observer.disconnect();
    manager.clearAll();
    for (const [element, runtime] of fieldMap.entries()) {
      element.removeEventListener("input", runtime.listener);
      if (runtime.debounceTimer) {
        window.clearTimeout(runtime.debounceTimer);
      }
    }
    fieldMap.clear();
    runtimeById.clear();
  });
}
