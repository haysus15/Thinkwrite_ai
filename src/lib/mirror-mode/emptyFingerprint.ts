import type { VoiceFingerprint } from '@/lib/mirror-core/voiceAnalysis';

export const EMPTY_FINGERPRINT: VoiceFingerprint = {
  vocabulary: {
    uniqueWordCount: 0,
    avgWordLength: 0,
    complexWordRatio: 0,
    contractionRatio: 0,
    topWords: [],
    rarityScore: 0,
  },
  rhythm: {
    avgSentenceLength: 0,
    sentenceVariation: 0,
    shortSentenceRatio: 0,
    longSentenceRatio: 0,
    avgParagraphLength: 0,
    paragraphVariation: 0,
  },
  punctuation: {
    exclamationRate: 0,
    questionRate: 0,
    semicolonRate: 0,
    dashRate: 0,
    ellipsisRate: 0,
    colonRate: 0,
    commaRate: 0,
  },
  voice: {
    hedgeDensity: 0,
    qualifierDensity: 0,
    assertiveDensity: 0,
    personalPronounRate: 0,
    formalityScore: 0,
    activeVoiceRatio: 0,
  },
  rhetoric: {
    questionOpenerRate: 0,
    transitionWordRate: 0,
    listUsageRate: 0,
    exampleUsageRate: 0,
    emphasisPatterns: [],
  },
  meta: {
    sampleWordCount: 0,
    sampleSentenceCount: 0,
    extractedAt: '',
    version: '1.0.0',
  },
};
