export type Chamber = "career" | "academic" | "creative" | "general";

export interface VoiceFingerprint {
  sessionId: string;
  chamber: Chamber;
  sourceType: "extension";
  capturedAt: string;
  wordCount: number;
  avgSentenceLength: number;
  sentenceLengthVariance: number;
  avgParagraphLength: number;
  shortSentenceRate: number;
  longSentenceRate: number;
  lexicalDensity: number;
  avgWordLength: number;
  contractionRate: number;
  passiveVoiceRate: number;
  hedgeWordRate: number;
  questionRate: number;
  exclamationRate: number;
  emDashRate: number;
  parentheticalRate: number;
  connectorPreferences: {
    additive: number;
    contrastive: number;
    causal: number;
    temporal: number;
  };
  openingPatterns: {
    subjectFirst: number;
    clauseFirst: number;
    conjunctionFirst: number;
    adverbFirst: number;
  };
}

const WORD_RE = /[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g;
const SENTENCE_SPLIT_RE = /(?<=[.!?])\s+(?=["'“”‘’(\[]*[A-Z0-9])/g;

const HEDGE_TERMS = [
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
  "kind of",
];

const BE_VERBS = new Set(["is", "are", "was", "were", "been", "being", "be"]);
const CONJUNCTION_START = new Set(["and", "but", "so"]);
const SUBORDINATE_START = new Set([
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
  "whereas",
]);
const ADVERB_START = new Set([
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
  "generally",
]);

const CONNECTORS = {
  additive: ["and", "also", "furthermore", "moreover", "plus"],
  contrastive: ["but", "however", "although", "yet", "instead"],
  causal: ["because", "since", "therefore", "so", "thus"],
  temporal: ["then", "next", "finally", "after", "before"],
} as const;
const CONNECTOR_LOOKUP: Record<keyof typeof CONNECTORS, Set<string>> = {
  additive: new Set(CONNECTORS.additive),
  contrastive: new Set(CONNECTORS.contrastive),
  causal: new Set(CONNECTORS.causal),
  temporal: new Set(CONNECTORS.temporal),
};

function round(value: number, precision = 4): number {
  const p = 10 ** precision;
  return Math.round(value * p) / p;
}

function getWords(text: string): string[] {
  const matches = text.match(WORD_RE);
  return matches ? matches : [];
}

function normalizeText(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\b\w+@\w+\.\w+\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getSentences(text: string): string[] {
  return normalizeText(text)
    .split(SENTENCE_SPLIT_RE)
    .map((item) => item.trim())
    .filter((sentence) => getWords(sentence).length >= 2);
}

function sentenceWordLengths(sentences: string[]): number[] {
  return sentences.map((sentence) => getWords(sentence).length).filter((count) => count > 0);
}

function stddev(values: number[], avg: number): number {
  if (!values.length) return 0;
  const variance = values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function countOccurrences(text: string, phrase: string): number {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`\\b${escaped}\\b`, "gi");
  return (text.match(regex) || []).length;
}

function contractionCount(words: string[]): number {
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

function passiveCount(sentences: string[]): number {
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

function openingPatternRates(sentences: string[]) {
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
    adverbFirst: round(adverbFirst / total),
  };
}

function connectorPreferences(sentences: string[]) {
  const counts = {
    additive: 0,
    contrastive: 0,
    causal: 0,
    temporal: 0,
  };

  for (const sentence of sentences) {
    const words = getWords(sentence).map((word) => word.toLowerCase()).slice(0, 4);
    if (!words.length) continue;
    for (const category of Object.keys(CONNECTORS) as Array<keyof typeof CONNECTORS>) {
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
    temporal: round(counts.temporal / total),
  };
}

export function extractFingerprint(
  text: string,
  chamber: Chamber,
  sessionId: string
): VoiceFingerprint | null {
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

  const avgSentenceLength = sentenceLengths.length
    ? sentenceLengths.reduce((sum, value) => sum + value, 0) / sentenceLengths.length
    : 0;

  const shortSentenceRate = sentenceLengths.length
    ? sentenceLengths.filter((length) => length < 8).length / sentenceLengths.length
    : 0;

  const longSentenceRate = sentenceLengths.length
    ? sentenceLengths.filter((length) => length > 25).length / sentenceLengths.length
    : 0;

  const paragraphSentenceCounts = (paragraphs.length ? paragraphs : [text]).map((paragraph) => {
    const count = getSentences(paragraph).length;
    return count > 0 ? count : 1;
  });

  const avgParagraphLength = paragraphSentenceCounts.reduce((sum, value) => sum + value, 0) /
    Math.max(paragraphSentenceCounts.length, 1);

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
    capturedAt: new Date().toISOString(),
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
    openingPatterns: openingPatternRates(sentences),
  };
}
