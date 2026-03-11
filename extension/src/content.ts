import { TextBufferManager, createStableFieldId } from "../lib/buffer";
import { extractFingerprint, type Chamber } from "../lib/extractor";
import { hasExtApi, localGet, runtimeSendMessage } from "../lib/runtime";

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

const fieldMap = new Map<HTMLElement, FieldRuntime>();
const runtimeById = new Map<string, FieldRuntime>();

function getHostname(): string {
  return window.location.hostname;
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
  const globalState = await localGet<Record<string, unknown>>("isPaused");
  if (Boolean(globalState.isPaused)) return true;

  const domainState = await localGet<Record<string, unknown>>(`paused:${hostname}`);
  if (Boolean(domainState[`paused:${hostname}`])) return true;

  return false;
}

const manager = new TextBufferManager((state) => {
  const runtime = runtimeById.get(state.fieldId);
  if (!runtime) return;
  void processField(runtime, "idle");
});

async function processField(runtime: FieldRuntime, mode: "input" | "idle"): Promise<void> {
  const hostname = getHostname();
  if (await isCollectionPaused(hostname)) return;

  const text = readFieldText(runtime.element);
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

  try {
    await runtimeSendMessage({
      type: "VOICE_FINGERPRINT",
      fingerprint,
      url: hostname,
    });
  } catch (err) {
    console.warn("[ThinkWrite] sendMessage failed:", err);
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
  scan();

  const observer = new MutationObserver(() => {
    scan();
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
