// lib/buffer.ts
var MIN_WORDS = 80;
var REEXTRACT_COOLDOWN_MS = 3e4;
var IDLE_MS = 15e3;
function countWords(text) {
  return (text.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) || []).length;
}
function createStableFieldId(element) {
  const tag = element.tagName.toLowerCase();
  const id = element.id || "";
  const name = element.getAttribute("name") || "";
  const role = element.getAttribute("role") || "";
  const parent = element.parentElement;
  let index = 0;
  if (parent) {
    const siblings = Array.from(parent.children).filter(
      (candidate) => candidate.tagName === element.tagName
    );
    index = Math.max(0, siblings.indexOf(element));
  }
  return `${tag}:${id}:${name}:${role}:${index}`;
}
var TextBufferManager = class {
  buffers = /* @__PURE__ */ new Map();
  idleCallback;
  constructor(idleCallback) {
    this.idleCallback = idleCallback;
  }
  upsert(fieldId, text, now = Date.now()) {
    const normalizedText = text.replace(/\s+/g, " ").trim();
    const wordCount = countWords(normalizedText);
    const current = this.buffers.get(fieldId);
    const next = current ? {
      ...current,
      text: normalizedText,
      wordCount,
      lastKeystrokeAt: now
    } : {
      fieldId,
      text: normalizedText,
      wordCount,
      lastKeystrokeAt: now,
      extracted: false,
      lastExtractedAt: null,
      lastExtractedWordCount: 0,
      idleTimer: null
    };
    this.resetIdleTimer(next);
    this.buffers.set(fieldId, next);
    const thresholdSatisfied = this.shouldExtractByThreshold(next, now);
    return {
      shouldExtract: thresholdSatisfied,
      reason: thresholdSatisfied ? "threshold" : null,
      state: this.toPublicState(next)
    };
  }
  markExtracted(fieldId, now = Date.now()) {
    const state = this.buffers.get(fieldId);
    if (!state) return;
    state.extracted = true;
    state.lastExtractedAt = now;
    state.lastExtractedWordCount = state.wordCount;
    this.resetIdleTimer(state);
    this.buffers.set(fieldId, state);
  }
  getState(fieldId) {
    const state = this.buffers.get(fieldId);
    return state ? this.toPublicState(state) : null;
  }
  clear(fieldId) {
    const state = this.buffers.get(fieldId);
    if (state?.idleTimer) {
      window.clearTimeout(state.idleTimer);
    }
    this.buffers.delete(fieldId);
  }
  clearAll() {
    for (const state of this.buffers.values()) {
      if (state.idleTimer) {
        window.clearTimeout(state.idleTimer);
      }
    }
    this.buffers.clear();
  }
  shouldExtractByThreshold(state, now) {
    if (state.wordCount < MIN_WORDS) return false;
    if (state.lastExtractedAt === null) return true;
    const elapsed = now - state.lastExtractedAt;
    if (elapsed < REEXTRACT_COOLDOWN_MS) return false;
    const newWords = state.wordCount - state.lastExtractedWordCount;
    return newWords >= MIN_WORDS;
  }
  shouldExtractByIdle(state) {
    if (state.wordCount < MIN_WORDS) return false;
    if (state.lastExtractedAt === null) return true;
    const newWords = state.wordCount - state.lastExtractedWordCount;
    return newWords > 0;
  }
  resetIdleTimer(state) {
    if (state.idleTimer) {
      window.clearTimeout(state.idleTimer);
    }
    state.idleTimer = window.setTimeout(() => {
      const latest = this.buffers.get(state.fieldId);
      if (!latest) return;
      if (!this.shouldExtractByIdle(latest)) return;
      this.idleCallback(this.toPublicState(latest), "idle");
    }, IDLE_MS);
  }
  toPublicState(state) {
    return {
      fieldId: state.fieldId,
      text: state.text,
      wordCount: state.wordCount,
      lastKeystrokeAt: state.lastKeystrokeAt,
      extracted: state.extracted
    };
  }
};

// lib/extractor.ts
var WORD_RE = /[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g;
var SENTENCE_SPLIT_RE = /(?<=[.!?])\s+(?=["'“”‘’(\[]*[A-Z0-9])/g;
var HEDGE_TERMS = [
  "perhaps",
  "maybe",
  "might",
  "could",
  "possibly",
  "i think",
  "i believe",
  "i feel",
  "seems",
  "appears",
  "somewhat",
  "rather",
  "fairly",
  "quite",
  "sort of",
  "kind of"
];
var BE_VERBS = /* @__PURE__ */ new Set(["is", "are", "was", "were", "been", "being", "be"]);
var CONJUNCTION_START = /* @__PURE__ */ new Set(["and", "but", "so"]);
var SUBORDINATE_START = /* @__PURE__ */ new Set([
  "although",
  "because",
  "since",
  "when",
  "while",
  "if",
  "unless",
  "after",
  "before",
  "though",
  "whereas"
]);
var ADVERB_START = /* @__PURE__ */ new Set([
  "however",
  "therefore",
  "meanwhile",
  "instead",
  "finally",
  "next",
  "then",
  "today",
  "yesterday",
  "often",
  "usually",
  "generally"
]);
var CONNECTORS = {
  additive: ["and", "also", "furthermore", "moreover", "plus"],
  contrastive: ["but", "however", "although", "yet", "instead"],
  causal: ["because", "since", "therefore", "so", "thus"],
  temporal: ["then", "next", "finally", "after", "before"]
};
var CONNECTOR_LOOKUP = {
  additive: new Set(CONNECTORS.additive),
  contrastive: new Set(CONNECTORS.contrastive),
  causal: new Set(CONNECTORS.causal),
  temporal: new Set(CONNECTORS.temporal)
};
function round(value, precision = 4) {
  const p = 10 ** precision;
  return Math.round(value * p) / p;
}
function getWords(text) {
  const matches = text.match(WORD_RE);
  return matches ? matches : [];
}
function normalizeText(text) {
  return text.replace(/https?:\/\/\S+/g, " ").replace(/\b\w+@\w+\.\w+\b/g, " ").replace(/\s+/g, " ").trim();
}
function getParagraphs(text) {
  return text.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
}
function getSentences(text) {
  return normalizeText(text).split(SENTENCE_SPLIT_RE).map((item) => item.trim()).filter((sentence) => getWords(sentence).length >= 2);
}
function sentenceWordLengths(sentences) {
  return sentences.map((sentence) => getWords(sentence).length).filter((count) => count > 0);
}
function stddev(values, avg) {
  if (!values.length) return 0;
  const variance = values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}
function countOccurrences(text, phrase) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`\\b${escaped}\\b`, "gi");
  return (text.match(regex) || []).length;
}
function contractionCount(words) {
  let count = 0;
  for (const raw of words) {
    const word = raw.toLowerCase();
    if (/(n't|'re|'ve|'ll|'d|'m)$/.test(word)) {
      count += 1;
      continue;
    }
    if (/'s$/.test(word) && /\b(it|that|there|here|what|who|where|when|how)'s$/i.test(word)) {
      count += 1;
    }
  }
  return count;
}
function passiveCount(sentences) {
  let count = 0;
  for (const sentence of sentences) {
    const words = getWords(sentence).map((w) => w.toLowerCase());
    let matched = false;
    for (let i = 0; i < words.length; i += 1) {
      if (!BE_VERBS.has(words[i])) continue;
      for (let j = i + 1; j <= Math.min(i + 3, words.length - 1); j += 1) {
        if (/(ed|en|t)$/.test(words[j])) {
          matched = true;
          break;
        }
      }
      if (matched) break;
    }
    if (matched) count += 1;
  }
  return count;
}
function openingPatternRates(sentences) {
  let subjectFirst = 0;
  let clauseFirst = 0;
  let conjunctionFirst = 0;
  let adverbFirst = 0;
  for (const sentence of sentences) {
    const words = getWords(sentence).map((word) => word.toLowerCase());
    if (!words.length) continue;
    const first = words[0];
    if (CONJUNCTION_START.has(first)) {
      conjunctionFirst += 1;
      continue;
    }
    if (SUBORDINATE_START.has(first)) {
      clauseFirst += 1;
      continue;
    }
    if (ADVERB_START.has(first) || /ly$/.test(first)) {
      adverbFirst += 1;
      continue;
    }
    subjectFirst += 1;
  }
  const total = Math.max(sentences.length, 1);
  return {
    subjectFirst: round(subjectFirst / total),
    clauseFirst: round(clauseFirst / total),
    conjunctionFirst: round(conjunctionFirst / total),
    adverbFirst: round(adverbFirst / total)
  };
}
function connectorPreferences(sentences) {
  const counts = {
    additive: 0,
    contrastive: 0,
    causal: 0,
    temporal: 0
  };
  for (const sentence of sentences) {
    const words = getWords(sentence).map((word) => word.toLowerCase()).slice(0, 4);
    if (!words.length) continue;
    for (const category of Object.keys(CONNECTORS)) {
      if (words.some((word) => CONNECTOR_LOOKUP[category].has(word))) {
        counts[category] += 1;
      }
    }
  }
  const total = Math.max(sentences.length, 1);
  return {
    additive: round(counts.additive / total),
    contrastive: round(counts.contrastive / total),
    causal: round(counts.causal / total),
    temporal: round(counts.temporal / total)
  };
}
function extractFingerprint(text, chamber, sessionId) {
  const normalized = normalizeText(text);
  const words = getWords(normalized);
  const wordCount = words.length;
  if (wordCount < 80) {
    return null;
  }
  const sentences = getSentences(text);
  const paragraphs = getParagraphs(text);
  const sentenceLengths = sentenceWordLengths(sentences);
  const sentenceCount = Math.max(sentences.length, 1);
  const avgSentenceLength = sentenceLengths.length ? sentenceLengths.reduce((sum, value) => sum + value, 0) / sentenceLengths.length : 0;
  const shortSentenceRate = sentenceLengths.length ? sentenceLengths.filter((length) => length < 8).length / sentenceLengths.length : 0;
  const longSentenceRate = sentenceLengths.length ? sentenceLengths.filter((length) => length > 25).length / sentenceLengths.length : 0;
  const paragraphSentenceCounts = (paragraphs.length ? paragraphs : [text]).map((paragraph) => {
    const count = getSentences(paragraph).length;
    return count > 0 ? count : 1;
  });
  const avgParagraphLength = paragraphSentenceCounts.reduce((sum, value) => sum + value, 0) / Math.max(paragraphSentenceCounts.length, 1);
  const uniqueCount = new Set(words.map((word) => word.toLowerCase())).size;
  const charCount = words.reduce((sum, word) => sum + word.replace(/['’-]/g, "").length, 0);
  const lowerText = normalized.toLowerCase();
  const hedgeCount = HEDGE_TERMS.reduce((sum, term) => sum + countOccurrences(lowerText, term), 0);
  const passiveCountValue = passiveCount(sentences);
  const contractionCountValue = contractionCount(words);
  const questionCount = sentences.filter((sentence) => sentence.trim().endsWith("?")).length;
  const exclamationCount = sentences.filter((sentence) => sentence.trim().endsWith("!")).length;
  const emDashCount = (normalized.match(/—/g) || []).length;
  const parentheticalCount = (normalized.match(/\([^()]{2,}\)/g) || []).length;
  return {
    sessionId,
    chamber,
    sourceType: "extension",
    capturedAt: (/* @__PURE__ */ new Date()).toISOString(),
    wordCount,
    avgSentenceLength: round(avgSentenceLength),
    sentenceLengthVariance: round(stddev(sentenceLengths, avgSentenceLength)),
    avgParagraphLength: round(avgParagraphLength),
    shortSentenceRate: round(shortSentenceRate),
    longSentenceRate: round(longSentenceRate),
    lexicalDensity: round(uniqueCount / wordCount),
    avgWordLength: round(charCount / wordCount),
    contractionRate: round(contractionCountValue / wordCount),
    passiveVoiceRate: round(passiveCountValue / sentenceCount),
    hedgeWordRate: round(hedgeCount / wordCount),
    questionRate: round(questionCount / sentenceCount),
    exclamationRate: round(exclamationCount / sentenceCount),
    emDashRate: round(emDashCount / sentenceCount),
    parentheticalRate: round(parentheticalCount / sentenceCount),
    connectorPreferences: connectorPreferences(sentences),
    openingPatterns: openingPatternRates(sentences)
  };
}

// lib/runtime.ts
var ext = globalThis.chrome ?? globalThis.browser ?? null;
function hasExtApi() {
  return Boolean(ext?.runtime);
}
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

// src/content.ts
var SESSION_ID = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
var CAPTURE_ENABLED_KEY = "capture_enabled";
var REQUEST_SOURCE = "thinkwrite-mirror-page";
var RESPONSE_SOURCE = "thinkwrite-mirror-extension";
var fieldMap = /* @__PURE__ */ new Map();
var runtimeById = /* @__PURE__ */ new Map();
function getHostname() {
  return window.location.hostname;
}
function isThinkWriteHost(hostname) {
  return hostname === "mirrormode.ai" || hostname === "www.mirrormode.ai" || hostname === "localhost";
}
function isSearchField(element) {
  const type = element.getAttribute("type")?.toLowerCase();
  const role = element.getAttribute("role")?.toLowerCase();
  const ariaLabel = element.getAttribute("aria-label")?.toLowerCase() || "";
  if (type === "search") return true;
  if (role === "searchbox") return true;
  if (ariaLabel.includes("search")) return true;
  return false;
}
function isPasswordField(element) {
  const type = element.getAttribute("type")?.toLowerCase();
  return type === "password";
}
function isEditableField(element) {
  const tag = element.tagName.toLowerCase();
  const role = element.getAttribute("role")?.toLowerCase();
  const contentEditable = element.getAttribute("contenteditable")?.toLowerCase();
  const qualifies = tag === "textarea" || (tag === "div" || tag === "article") && contentEditable === "true" || role === "textbox";
  if (!qualifies) return false;
  if (isSearchField(element)) return false;
  if (isPasswordField(element)) return false;
  return true;
}
function readFieldText(field) {
  if (field instanceof HTMLTextAreaElement) {
    return field.value || "";
  }
  if (field instanceof HTMLInputElement) {
    return field.value || "";
  }
  return field.innerText || field.textContent || "";
}
async function isCollectionPaused(hostname) {
  try {
    const storage = (globalThis.chrome ?? globalThis.browser)?.storage?.local;
    if (!storage) return false;
    const result = await new Promise((resolve) => {
      storage.get(["capture_enabled", "isPaused", `paused:${hostname}`], (data) => {
        resolve(data || {});
      });
    });
    if (result["capture_enabled"] === false) return true;
    if (result["isPaused"] === true) return true;
    if (result[`paused:${hostname}`] === true) return true;
    return false;
  } catch {
    return false;
  }
}
function installMirrorSettingsBridge() {
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== REQUEST_SOURCE || typeof data.requestId !== "string") {
      return;
    }
    const reply = async () => {
      try {
        if (data.action === "get_capture_enabled") {
          const state = await localGet(CAPTURE_ENABLED_KEY);
          const enabled = state[CAPTURE_ENABLED_KEY] !== false;
          window.postMessage(
            {
              source: RESPONSE_SOURCE,
              requestId: data.requestId,
              ok: true,
              value: enabled
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
              value: data.value
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
            error: error instanceof Error ? error.message : "Bridge error"
          },
          window.location.origin
        );
      }
    };
    void reply();
  });
}
var manager = new TextBufferManager((state) => {
  const runtime = runtimeById.get(state.fieldId);
  if (!runtime) return;
  void processField(runtime, "idle");
});
async function processField(runtime, mode) {
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
  const fingerprint = extractFingerprint(evaluation.state.text, "general", SESSION_ID);
  if (!fingerprint) {
    return;
  }
  manager.markExtracted(runtime.fieldId);
  let sent = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await runtimeSendMessage({
        type: "VOICE_FINGERPRINT",
        fingerprint,
        url: hostname
      });
      sent = true;
      break;
    } catch (err) {
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      } else {
        console.warn("[MirrorMode] sendMessage failed after 3 attempts:", err);
      }
    }
  }
}
function attachField(element) {
  if (fieldMap.has(element)) return;
  if (!isEditableField(element)) return;
  const fieldId = createStableFieldId(element);
  const runtime = {
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
    }
  };
  element.addEventListener("input", runtime.listener, { passive: true });
  fieldMap.set(element, runtime);
  runtimeById.set(fieldId, runtime);
}
function detachRemovedFields() {
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
function scan() {
  const candidates = document.querySelectorAll(
    "textarea, div[contenteditable='true'], article[contenteditable='true'], [role='textbox']"
  );
  candidates.forEach((candidate) => attachField(candidate));
  detachRemovedFields();
}
function shouldRunOnThisFrame() {
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
    subtree: true
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
//# sourceMappingURL=content.js.map
