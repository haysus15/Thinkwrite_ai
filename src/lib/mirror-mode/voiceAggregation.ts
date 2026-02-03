// src/lib/mirror-mode/voiceAggregation.ts
// The learning engine that combines fingerprints into your persistent voice

import type { VoiceFingerprint } from './voiceAnalysis';

/**
 * VoiceProfile - The complete learned voice stored in the database
 * This is what lives in voice_profiles table
 */
export type VoiceProfile = {
  userId: string;
  aggregateFingerprint: VoiceFingerprint;
  confidenceLevel: number;          // 0-100
  documentCount: number;
  totalWordCount: number;
  lastTrainedAt: string;
  evolutionHistory: VoiceEvolution[];
};

/**
 * Track how voice evolves over time
 */
export type VoiceEvolution = {
  timestamp: string;
  documentId: string;
  documentName: string;              // NEW: filename
  writingType: string;               // NEW: writing type
  changesMade: string[];             // What shifted
  confidenceDelta: number;           // How much confidence changed
  confidenceLevel: number;           // NEW: absolute confidence after this doc
  totalWordCount: number;            // NEW: cumulative word count
  totalDocuments: number;            // NEW: document count at this point
};

/**
 * Metadata passed when learning from a document
 */
export type DocumentMeta = {
  fileName: string;
  writingType: string;
  wordCount: number;
};

// ============================================
// WEIGHTED AVERAGING UTILITIES
// ============================================

/**
 * Weighted average of two numbers based on sample sizes
 */
function weightedAverage(
  existingValue: number,
  existingWeight: number,
  newValue: number,
  newWeight: number
): number {
  const totalWeight = existingWeight + newWeight;
  if (totalWeight === 0) return 0;
  return (existingValue * existingWeight + newValue * newWeight) / totalWeight;
}

/**
 * Merge two arrays with frequency-based ranking
 * Used for topWords - keeps most common across all documents
 */
function mergeWordLists(
  existing: string[],
  existingWeight: number,
  newWords: string[],
  newWeight: number,
  maxLength: number = 20
): string[] {
  const scores: Record<string, number> = {};
  
  // Score existing words by position (higher position = higher score)
  existing.forEach((word, idx) => {
    const positionScore = (existing.length - idx) * existingWeight;
    scores[word] = (scores[word] || 0) + positionScore;
  });
  
  // Score new words similarly
  newWords.forEach((word, idx) => {
    const positionScore = (newWords.length - idx) * newWeight;
    scores[word] = (scores[word] || 0) + positionScore;
  });
  
  // Return top N words by combined score
  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxLength)
    .map(([word]) => word);
}

/**
 * Merge emphasis pattern arrays (keep unique patterns)
 */
function mergeEmphasisPatterns(existing: string[], newPatterns: string[]): string[] {
  const combined = new Set([...existing, ...newPatterns]);
  return Array.from(combined);
}

// ============================================
// MAIN AGGREGATION FUNCTION
// ============================================

/**
 * Merge a new document's fingerprint into the existing voice profile
 * This is THE LEARNING FUNCTION - called after every document upload
 */
export function aggregateFingerprints(
  existingProfile: VoiceProfile | null,
  newFingerprint: VoiceFingerprint,
  documentId: string,
  documentMeta?: DocumentMeta
): VoiceProfile {
  // If no existing profile, this is the first document
  if (!existingProfile) {
    return createInitialProfile(newFingerprint, documentId, documentMeta);
  }

  const existing = existingProfile.aggregateFingerprint;
  const existingWeight = existingProfile.totalWordCount;
  const newWeight = newFingerprint.meta.sampleWordCount;

  // Track what changed for evolution history
  const changes: string[] = [];

  // ---- AGGREGATE VOCABULARY ----
  const vocabulary = {
    uniqueWordCount: Math.round(weightedAverage(
      existing.vocabulary.uniqueWordCount,
      existingWeight,
      newFingerprint.vocabulary.uniqueWordCount,
      newWeight
    )),
    avgWordLength: weightedAverage(
      existing.vocabulary.avgWordLength,
      existingWeight,
      newFingerprint.vocabulary.avgWordLength,
      newWeight
    ),
    complexWordRatio: weightedAverage(
      existing.vocabulary.complexWordRatio,
      existingWeight,
      newFingerprint.vocabulary.complexWordRatio,
      newWeight
    ),
    contractionRatio: weightedAverage(
      existing.vocabulary.contractionRatio,
      existingWeight,
      newFingerprint.vocabulary.contractionRatio,
      newWeight
    ),
    topWords: mergeWordLists(
      existing.vocabulary.topWords,
      existingWeight,
      newFingerprint.vocabulary.topWords,
      newWeight
    ),
    rarityScore: weightedAverage(
      existing.vocabulary.rarityScore,
      existingWeight,
      newFingerprint.vocabulary.rarityScore,
      newWeight
    ),
  };

  // Track vocabulary changes
  if (Math.abs(vocabulary.avgWordLength - existing.vocabulary.avgWordLength) > 0.3) {
    changes.push('vocabulary-complexity-shift');
  }

  // ---- AGGREGATE RHYTHM ----
  const rhythm = {
    avgSentenceLength: weightedAverage(
      existing.rhythm.avgSentenceLength,
      existingWeight,
      newFingerprint.rhythm.avgSentenceLength,
      newWeight
    ),
    sentenceVariation: weightedAverage(
      existing.rhythm.sentenceVariation,
      existingWeight,
      newFingerprint.rhythm.sentenceVariation,
      newWeight
    ),
    shortSentenceRatio: weightedAverage(
      existing.rhythm.shortSentenceRatio,
      existingWeight,
      newFingerprint.rhythm.shortSentenceRatio,
      newWeight
    ),
    longSentenceRatio: weightedAverage(
      existing.rhythm.longSentenceRatio,
      existingWeight,
      newFingerprint.rhythm.longSentenceRatio,
      newWeight
    ),
    avgParagraphLength: weightedAverage(
      existing.rhythm.avgParagraphLength,
      existingWeight,
      newFingerprint.rhythm.avgParagraphLength,
      newWeight
    ),
    paragraphVariation: weightedAverage(
      existing.rhythm.paragraphVariation,
      existingWeight,
      newFingerprint.rhythm.paragraphVariation,
      newWeight
    ),
  };

  // Track rhythm changes
  if (Math.abs(rhythm.avgSentenceLength - existing.rhythm.avgSentenceLength) > 3) {
    changes.push('sentence-length-shift');
  }

  // ---- AGGREGATE PUNCTUATION ----
  const punctuation = {
    exclamationRate: weightedAverage(
      existing.punctuation.exclamationRate,
      existingWeight,
      newFingerprint.punctuation.exclamationRate,
      newWeight
    ),
    questionRate: weightedAverage(
      existing.punctuation.questionRate,
      existingWeight,
      newFingerprint.punctuation.questionRate,
      newWeight
    ),
    semicolonRate: weightedAverage(
      existing.punctuation.semicolonRate,
      existingWeight,
      newFingerprint.punctuation.semicolonRate,
      newWeight
    ),
    dashRate: weightedAverage(
      existing.punctuation.dashRate,
      existingWeight,
      newFingerprint.punctuation.dashRate,
      newWeight
    ),
    ellipsisRate: weightedAverage(
      existing.punctuation.ellipsisRate,
      existingWeight,
      newFingerprint.punctuation.ellipsisRate,
      newWeight
    ),
    colonRate: weightedAverage(
      existing.punctuation.colonRate,
      existingWeight,
      newFingerprint.punctuation.colonRate,
      newWeight
    ),
    commaRate: weightedAverage(
      existing.punctuation.commaRate,
      existingWeight,
      newFingerprint.punctuation.commaRate,
      newWeight
    ),
  };

  // ---- AGGREGATE VOICE ----
  const voice = {
    hedgeDensity: weightedAverage(
      existing.voice.hedgeDensity,
      existingWeight,
      newFingerprint.voice.hedgeDensity,
      newWeight
    ),
    qualifierDensity: weightedAverage(
      existing.voice.qualifierDensity,
      existingWeight,
      newFingerprint.voice.qualifierDensity,
      newWeight
    ),
    assertiveDensity: weightedAverage(
      existing.voice.assertiveDensity,
      existingWeight,
      newFingerprint.voice.assertiveDensity,
      newWeight
    ),
    personalPronounRate: weightedAverage(
      existing.voice.personalPronounRate,
      existingWeight,
      newFingerprint.voice.personalPronounRate,
      newWeight
    ),
    formalityScore: weightedAverage(
      existing.voice.formalityScore,
      existingWeight,
      newFingerprint.voice.formalityScore,
      newWeight
    ),
    activeVoiceRatio: weightedAverage(
      existing.voice.activeVoiceRatio,
      existingWeight,
      newFingerprint.voice.activeVoiceRatio,
      newWeight
    ),
  };

  // Track voice changes
  if (Math.abs(voice.formalityScore - existing.voice.formalityScore) > 0.1) {
    changes.push('formality-shift');
  }

  // ---- AGGREGATE RHETORIC ----
  const rhetoric = {
    questionOpenerRate: weightedAverage(
      existing.rhetoric.questionOpenerRate,
      existingWeight,
      newFingerprint.rhetoric.questionOpenerRate,
      newWeight
    ),
    transitionWordRate: weightedAverage(
      existing.rhetoric.transitionWordRate,
      existingWeight,
      newFingerprint.rhetoric.transitionWordRate,
      newWeight
    ),
    listUsageRate: weightedAverage(
      existing.rhetoric.listUsageRate,
      existingWeight,
      newFingerprint.rhetoric.listUsageRate,
      newWeight
    ),
    exampleUsageRate: weightedAverage(
      existing.rhetoric.exampleUsageRate,
      existingWeight,
      newFingerprint.rhetoric.exampleUsageRate,
      newWeight
    ),
    emphasisPatterns: mergeEmphasisPatterns(
      existing.rhetoric.emphasisPatterns,
      newFingerprint.rhetoric.emphasisPatterns
    ),
  };

  // ---- BUILD NEW AGGREGATE ----
  const newTotalWordCount = existingProfile.totalWordCount + newFingerprint.meta.sampleWordCount;
  const newDocumentCount = existingProfile.documentCount + 1;

  const aggregateFingerprint: VoiceFingerprint = {
    vocabulary,
    rhythm,
    punctuation,
    voice,
    rhetoric,
    meta: {
      sampleWordCount: newTotalWordCount,
      sampleSentenceCount: existing.meta.sampleSentenceCount + newFingerprint.meta.sampleSentenceCount,
      extractedAt: new Date().toISOString(),
      version: '1.0.0',
    },
  };

  // Calculate new confidence level
  const newConfidenceLevel = calculateConfidence(newDocumentCount, newTotalWordCount);
  const confidenceDelta = newConfidenceLevel - existingProfile.confidenceLevel;

  // Add to evolution history with enriched data
  const evolutionEntry: VoiceEvolution = {
    timestamp: new Date().toISOString(),
    documentId,
    documentName: documentMeta?.fileName || 'Unknown',
    writingType: documentMeta?.writingType || 'other',
    changesMade: changes.length > 0 ? changes : ['minor-refinement'],
    confidenceDelta,
    confidenceLevel: newConfidenceLevel,
    totalWordCount: newTotalWordCount,
    totalDocuments: newDocumentCount,
  };

  // Keep only last 50 evolution entries
  const evolutionHistory = [
    ...existingProfile.evolutionHistory.slice(-49),
    evolutionEntry,
  ];

  return {
    userId: existingProfile.userId,
    aggregateFingerprint,
    confidenceLevel: newConfidenceLevel,
    documentCount: newDocumentCount,
    totalWordCount: newTotalWordCount,
    lastTrainedAt: new Date().toISOString(),
    evolutionHistory,
  };
}

// ============================================
// CONFIDENCE CALCULATION
// ============================================

/**
 * Calculate confidence level (0-100) based on sample size
 * 
 * Confidence factors:
 * - Document count: More documents = more consistent signal
 * - Word count: More words = more reliable patterns
 * - Diminishing returns after certain thresholds
 */
export function calculateConfidence(documentCount: number, totalWordCount: number): number {
  // Document count factor (max contribution: 40 points)
  // 1 doc = 10, 3 docs = 25, 5 docs = 35, 10+ docs = 40
  const docFactor = Math.min(40, 10 + (documentCount - 1) * 7.5);

  // Word count factor (max contribution: 60 points)
  // 500 words = 15, 2000 words = 35, 5000 words = 50, 10000+ words = 60
  let wordFactor: number;
  if (totalWordCount < 500) {
    wordFactor = (totalWordCount / 500) * 15;
  } else if (totalWordCount < 2000) {
    wordFactor = 15 + ((totalWordCount - 500) / 1500) * 20;
  } else if (totalWordCount < 5000) {
    wordFactor = 35 + ((totalWordCount - 2000) / 3000) * 15;
  } else if (totalWordCount < 10000) {
    wordFactor = 50 + ((totalWordCount - 5000) / 5000) * 10;
  } else {
    wordFactor = 60;
  }

  const rawConfidence = docFactor + wordFactor;
  
  // Round and clamp
  return Math.min(100, Math.max(0, Math.round(rawConfidence)));
}

/**
 * Get confidence label from score
 */
export function getConfidenceLabel(confidence: number): string {
  if (confidence >= 85) return 'Mastered';
  if (confidence >= 65) return 'Confident';
  if (confidence >= 45) return 'Developing';
  if (confidence >= 25) return 'Learning';
  return 'Initializing';
}

// ============================================
// INITIAL PROFILE CREATION
// ============================================

/**
 * Create the first voice profile from a single document
 */
function createInitialProfile(
  fingerprint: VoiceFingerprint,
  documentId: string,
  documentMeta?: DocumentMeta
): VoiceProfile {
  const documentCount = 1;
  const totalWordCount = fingerprint.meta.sampleWordCount;
  const initialConfidence = calculateConfidence(documentCount, totalWordCount);

  return {
    userId: '', // Will be set by caller
    aggregateFingerprint: fingerprint,
    confidenceLevel: initialConfidence,
    documentCount,
    totalWordCount,
    lastTrainedAt: new Date().toISOString(),
    evolutionHistory: [{
      timestamp: new Date().toISOString(),
      documentId,
      documentName: documentMeta?.fileName || 'Unknown',
      writingType: documentMeta?.writingType || 'other',
      changesMade: ['initial-profile-created'],
      confidenceDelta: initialConfidence,
      confidenceLevel: initialConfidence,
      totalWordCount,
      totalDocuments: documentCount,
    }],
  };
}

// ============================================
// PROFILE COMPARISON UTILITIES
// ============================================

/**
 * Compare two fingerprints and identify key differences
 * Useful for showing evolution or detecting outlier documents
 */
export function compareFingerprints(
  fp1: VoiceFingerprint,
  fp2: VoiceFingerprint
): { dimension: string; delta: number; significance: 'high' | 'medium' | 'low' }[] {
  const differences: { dimension: string; delta: number; significance: 'high' | 'medium' | 'low' }[] = [];

  // Compare key dimensions
  const comparisons = [
    { 
      dimension: 'formality', 
      value1: fp1.voice.formalityScore, 
      value2: fp2.voice.formalityScore,
      threshold: { high: 0.2, medium: 0.1 }
    },
    { 
      dimension: 'sentence-length', 
      value1: fp1.rhythm.avgSentenceLength, 
      value2: fp2.rhythm.avgSentenceLength,
      threshold: { high: 5, medium: 2 }
    },
    { 
      dimension: 'hedge-usage', 
      value1: fp1.voice.hedgeDensity * 100, 
      value2: fp2.voice.hedgeDensity * 100,
      threshold: { high: 1, medium: 0.5 }
    },
    { 
      dimension: 'word-complexity', 
      value1: fp1.vocabulary.complexWordRatio * 100, 
      value2: fp2.vocabulary.complexWordRatio * 100,
      threshold: { high: 5, medium: 2 }
    },
    { 
      dimension: 'personal-voice', 
      value1: fp1.voice.personalPronounRate * 100, 
      value2: fp2.voice.personalPronounRate * 100,
      threshold: { high: 3, medium: 1 }
    },
  ];

  for (const comp of comparisons) {
    const delta = comp.value2 - comp.value1;
    const absDelta = Math.abs(delta);
    
    let significance: 'high' | 'medium' | 'low';
    if (absDelta >= comp.threshold.high) {
      significance = 'high';
    } else if (absDelta >= comp.threshold.medium) {
      significance = 'medium';
    } else {
      significance = 'low';
    }

    differences.push({
      dimension: comp.dimension,
      delta: Math.round(delta * 100) / 100,
      significance,
    });
  }

  return differences;
}

// ============================================
// EXPORT
// ============================================

export default {
  aggregateFingerprints,
  calculateConfidence,
  getConfidenceLabel,
  compareFingerprints,
};