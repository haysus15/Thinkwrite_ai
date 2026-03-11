export interface BufferState {
  fieldId: string;
  text: string;
  wordCount: number;
  lastKeystrokeAt: number;
  extracted: boolean;
}

const MIN_WORDS = 80;
const REEXTRACT_COOLDOWN_MS = 30_000;
const IDLE_MS = 90_000;

export interface BufferEvaluation {
  shouldExtract: boolean;
  reason: "threshold" | "idle" | null;
  state: BufferState;
}

type InternalBufferState = BufferState & {
  lastExtractedAt: number | null;
  lastExtractedWordCount: number;
  idleTimer: number | null;
};

type IdleCallback = (state: BufferState, reason: "idle") => void;

function countWords(text: string): number {
  return (text.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) || []).length;
}

export function createStableFieldId(element: HTMLElement): string {
  const tag = element.tagName.toLowerCase();
  const id = element.id || "";
  const name = element.getAttribute("name") || "";
  const role = element.getAttribute("role") || "";

  const parent = element.parentElement;
  let index = 0;
  if (parent) {
    const siblings = Array.from(parent.children).filter(
      (candidate) => (candidate as HTMLElement).tagName === element.tagName
    );
    index = Math.max(0, siblings.indexOf(element));
  }

  return `${tag}:${id}:${name}:${role}:${index}`;
}

export class TextBufferManager {
  private readonly buffers = new Map<string, InternalBufferState>();
  private readonly idleCallback: IdleCallback;

  constructor(idleCallback: IdleCallback) {
    this.idleCallback = idleCallback;
  }

  upsert(fieldId: string, text: string, now = Date.now()): BufferEvaluation {
    const normalizedText = text.replace(/\s+/g, " ").trim();
    const wordCount = countWords(normalizedText);

    const current = this.buffers.get(fieldId);
    const next: InternalBufferState = current
      ? {
          ...current,
          text: normalizedText,
          wordCount,
          lastKeystrokeAt: now,
        }
      : {
          fieldId,
          text: normalizedText,
          wordCount,
          lastKeystrokeAt: now,
          extracted: false,
          lastExtractedAt: null,
          lastExtractedWordCount: 0,
          idleTimer: null,
        };

    this.resetIdleTimer(next);
    this.buffers.set(fieldId, next);

    const thresholdSatisfied = this.shouldExtractByThreshold(next, now);
    return {
      shouldExtract: thresholdSatisfied,
      reason: thresholdSatisfied ? "threshold" : null,
      state: this.toPublicState(next),
    };
  }

  markExtracted(fieldId: string, now = Date.now()): void {
    const state = this.buffers.get(fieldId);
    if (!state) return;

    state.extracted = true;
    state.lastExtractedAt = now;
    state.lastExtractedWordCount = state.wordCount;
    this.resetIdleTimer(state);
    this.buffers.set(fieldId, state);
  }

  getState(fieldId: string): BufferState | null {
    const state = this.buffers.get(fieldId);
    return state ? this.toPublicState(state) : null;
  }

  clear(fieldId: string): void {
    const state = this.buffers.get(fieldId);
    if (state?.idleTimer) {
      window.clearTimeout(state.idleTimer);
    }
    this.buffers.delete(fieldId);
  }

  clearAll(): void {
    for (const state of this.buffers.values()) {
      if (state.idleTimer) {
        window.clearTimeout(state.idleTimer);
      }
    }
    this.buffers.clear();
  }

  private shouldExtractByThreshold(state: InternalBufferState, now: number): boolean {
    if (state.wordCount < MIN_WORDS) return false;
    if (state.lastExtractedAt === null) return true;

    const elapsed = now - state.lastExtractedAt;
    if (elapsed < REEXTRACT_COOLDOWN_MS) return false;

    const newWords = state.wordCount - state.lastExtractedWordCount;
    return newWords >= MIN_WORDS;
  }

  private shouldExtractByIdle(state: InternalBufferState): boolean {
    if (state.wordCount < MIN_WORDS) return false;
    if (state.lastExtractedAt === null) return true;

    const newWords = state.wordCount - state.lastExtractedWordCount;
    return newWords > 0;
  }

  private resetIdleTimer(state: InternalBufferState): void {
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

  private toPublicState(state: InternalBufferState): BufferState {
    return {
      fieldId: state.fieldId,
      text: state.text,
      wordCount: state.wordCount,
      lastKeystrokeAt: state.lastKeystrokeAt,
      extracted: state.extracted,
    };
  }
}

export const BufferThresholds = {
  minWords: MIN_WORDS,
  reextractCooldownMs: REEXTRACT_COOLDOWN_MS,
  idleMs: IDLE_MS,
} as const;
