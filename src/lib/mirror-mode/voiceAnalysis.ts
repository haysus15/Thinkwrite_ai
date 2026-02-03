// src/lib/mirror-mode/voiceAnalysis.ts
// The core algorithm that extracts what makes YOUR writing unique

/**
 * VoiceFingerprint - The complete model of a user's writing style
 * This is what gets stored in voice_profiles.aggregate_fingerprint
 */
export type VoiceFingerprint = {
  // Lexical patterns - WHAT words you use
  vocabulary: {
    uniqueWordCount: number;
    avgWordLength: number;
    complexWordRatio: number;      // Words with 3+ syllables
    contractionRatio: number;      // "don't" vs "do not"
    topWords: string[];            // Your 20 most-used content words
    rarityScore: number;           // How unique your vocabulary is (0-1)
  };

  // Sentence structure - HOW you construct sentences
  rhythm: {
    avgSentenceLength: number;
    sentenceVariation: number;     // Std deviation of sentence lengths
    shortSentenceRatio: number;    // Under 10 words
    longSentenceRatio: number;     // Over 25 words
    avgParagraphLength: number;
    paragraphVariation: number;
  };

  // Punctuation habits - Your mechanical style
  punctuation: {
    exclamationRate: number;       // Per 100 sentences
    questionRate: number;          // Per 100 sentences
    semicolonRate: number;         // Per 100 sentences
    dashRate: number;              // Em-dash, en-dash usage
    ellipsisRate: number;          // ... usage
    colonRate: number;
    commaRate: number;             // Per 100 words
  };

  // Voice markers - Your personality in writing
  voice: {
    hedgeDensity: number;          // "maybe", "perhaps", "I think"
    qualifierDensity: number;      // "very", "really", "quite"
    assertiveDensity: number;      // "clearly", "obviously", "definitely"
    personalPronounRate: number;   // "I", "me", "my" usage
    formalityScore: number;        // 0-1 (casual to formal)
    activeVoiceRatio: number;      // Active vs passive voice
  };

  // Rhetorical patterns - How you structure arguments
  rhetoric: {
    questionOpenerRate: number;    // Start paragraphs with questions
    transitionWordRate: number;    // "however", "therefore", "moreover"
    listUsageRate: number;         // Enumeration patterns
    exampleUsageRate: number;      // "for example", "such as"
    emphasisPatterns: string[];    // Your emphasis style (caps, italics, etc.)
  };

  // Metadata
  meta: {
    sampleWordCount: number;
    sampleSentenceCount: number;
    extractedAt: string;
    version: string;
  };
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 3) return 1;
  
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
  word = word.replace(/^y/, '');
  
  const matches = word.match(/[aeiouy]{1,2}/g);
  return matches ? matches.length : 1;
}

function isComplexWord(word: string): boolean {
  return countSyllables(word) >= 3;
}

function getStopWords(): Set<string> {
  return new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
    'this', 'that', 'these', 'those', 'it', 'its', 'they', 'them', 'their',
    'he', 'she', 'him', 'her', 'his', 'hers', 'we', 'us', 'our', 'you', 'your',
    'who', 'which', 'what', 'where', 'when', 'why', 'how', 'all', 'each',
    'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
    'not', 'only', 'same', 'so', 'than', 'too', 'very', 'just', 'also'
  ]);
}

function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
}

function safeRatio(numerator: number, denominator: number, decimals = 4): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

// ============================================
// PATTERN MATCHERS
// ============================================

const HEDGE_WORDS = /\b(maybe|perhaps|i think|i believe|i guess|i suppose|kind of|sort of|somewhat|probably|possibly|might|could be|seems|appears|tend to|in my opinion)\b/gi;

const QUALIFIER_WORDS = /\b(very|really|quite|pretty|fairly|rather|somewhat|extremely|incredibly|absolutely|totally|completely|definitely|certainly)\b/gi;

const ASSERTIVE_WORDS = /\b(clearly|obviously|definitely|certainly|undoubtedly|surely|indeed|of course|naturally|evidently)\b/gi;

const TRANSITION_WORDS = /\b(however|therefore|moreover|furthermore|nevertheless|nonetheless|consequently|accordingly|hence|thus|meanwhile|subsequently|additionally|likewise|similarly|conversely|otherwise|instead|rather|alternatively)\b/gi;

const EXAMPLE_PHRASES = /\b(for example|for instance|such as|like|including|namely|specifically|particularly|especially|e\.g\.|i\.e\.)\b/gi;

const PERSONAL_PRONOUNS = /\b(i|me|my|mine|myself|we|us|our|ours|ourselves)\b/gi;

const CONTRACTIONS = /\b(i'm|i've|i'll|i'd|you're|you've|you'll|you'd|he's|she's|it's|we're|we've|we'll|we'd|they're|they've|they'll|they'd|isn't|aren't|wasn't|weren't|hasn't|haven't|hadn't|doesn't|don't|didn't|won't|wouldn't|couldn't|shouldn't|can't|cannot|mustn't|let's|that's|who's|what's|here's|there's|where's|how's|ain't)\b/gi;

const PASSIVE_VOICE = /\b(was|were|is|are|been|being|be)\s+(\w+ed|made|done|given|taken|seen|known|found|shown|told|written|read|built|bought|brought|caught|chosen|drawn|driven|eaten|fallen|felt|forgotten|gotten|grown|hidden|hit|held|kept|left|lost|meant|met|paid|put|run|said|sat|sent|set|shot|shown|shut|sung|slept|sold|spent|stood|struck|swept|taught|thought|thrown|understood|won|worn|wound|written)\b/gi;

// ============================================
// MAIN EXTRACTION FUNCTION
// ============================================

export function extractVoiceFingerprint(text: string): VoiceFingerprint {
  // Clean and normalize text
  const cleanText = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // ---- TOKENIZATION ----
  const words: string[] = cleanText.match(/\b[a-zA-Z]+(?:'[a-zA-Z]+)?\b/g) || [];
  const wordCount = words.length;
  
  const sentences = cleanText.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
  const sentenceCount = sentences.length;
  
  const paragraphs = cleanText.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  const paragraphCount = paragraphs.length;

  // ---- VOCABULARY ANALYSIS ----
  const stopWords = getStopWords();
  const contentWords = words.filter(w => !stopWords.has(w.toLowerCase()));
  const uniqueWords = new Set(words.map(w => w.toLowerCase()));
  
  const wordFrequency: Record<string, number> = {};
  contentWords.forEach(w => {
    const lower = w.toLowerCase();
    wordFrequency[lower] = (wordFrequency[lower] || 0) + 1;
  });
  
  const topWords = Object.entries(wordFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word]) => word);
  
  const avgWordLength = words.length > 0 
    ? words.reduce((sum: number, w: string) => sum + w.length, 0) / words.length 
    : 0;
  
  const complexWords = words.filter(isComplexWord);
  const complexWordRatio = safeRatio(complexWords.length, wordCount);
  
  const contractionMatches = cleanText.match(CONTRACTIONS) || [];
  const contractionRatio = safeRatio(contractionMatches.length, wordCount);

  // Vocabulary rarity score (unique words / total words)
  const rarityScore = safeRatio(uniqueWords.size, wordCount);

  // ---- SENTENCE RHYTHM ----
  const sentenceLengths = sentences.map(s => {
    const sentenceWords = s.match(/\b[a-zA-Z]+(?:'[a-zA-Z]+)?\b/g) || [];
    return sentenceWords.length;
  });
  
  const avgSentenceLength = sentenceLengths.length > 0
    ? sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length
    : 0;
  
  const sentenceVariation = standardDeviation(sentenceLengths);
  
  const shortSentences = sentenceLengths.filter(len => len < 10).length;
  const longSentences = sentenceLengths.filter(len => len > 25).length;
  const shortSentenceRatio = safeRatio(shortSentences, sentenceCount);
  const longSentenceRatio = safeRatio(longSentences, sentenceCount);

  // ---- PARAGRAPH RHYTHM ----
  const paragraphLengths = paragraphs.map(p => {
    const pWords = p.match(/\b[a-zA-Z]+(?:'[a-zA-Z]+)?\b/g) || [];
    return pWords.length;
  });
  
  const avgParagraphLength = paragraphLengths.length > 0
    ? paragraphLengths.reduce((a, b) => a + b, 0) / paragraphLengths.length
    : 0;
  
  const paragraphVariation = standardDeviation(paragraphLengths);

  // ---- PUNCTUATION ----
  const exclamations = (cleanText.match(/!/g) || []).length;
  const questions = (cleanText.match(/\?/g) || []).length;
  const semicolons = (cleanText.match(/;/g) || []).length;
  const dashes = (cleanText.match(/[—–-]{1,2}/g) || []).length;
  const ellipses = (cleanText.match(/\.{3}|…/g) || []).length;
  const colons = (cleanText.match(/:/g) || []).length;
  const commas = (cleanText.match(/,/g) || []).length;

  const per100Sentences = (count: number) => safeRatio(count * 100, sentenceCount);
  const per100Words = (count: number) => safeRatio(count * 100, wordCount);

  // ---- VOICE MARKERS ----
  const hedges = (cleanText.match(HEDGE_WORDS) || []).length;
  const qualifiers = (cleanText.match(QUALIFIER_WORDS) || []).length;
  const assertives = (cleanText.match(ASSERTIVE_WORDS) || []).length;
  const personalPronouns = (cleanText.match(PERSONAL_PRONOUNS) || []).length;
  const passiveVoice = (cleanText.match(PASSIVE_VOICE) || []).length;

  const hedgeDensity = safeRatio(hedges, wordCount);
  const qualifierDensity = safeRatio(qualifiers, wordCount);
  const assertiveDensity = safeRatio(assertives, wordCount);
  const personalPronounRate = safeRatio(personalPronouns, wordCount);
  
  // Active voice ratio (1 - passive indicators ratio)
  const activeVoiceRatio = 1 - Math.min(safeRatio(passiveVoice, sentenceCount), 1);

  // Formality score (0 = casual, 1 = formal)
  // Based on: contractions (casual), complex words (formal), personal pronouns (casual)
  const formalityScore = Math.min(1, Math.max(0,
    (complexWordRatio * 2) - (contractionRatio * 3) - (personalPronounRate * 0.5) + 0.5
  ));

  // ---- RHETORICAL PATTERNS ----
  const transitions = (cleanText.match(TRANSITION_WORDS) || []).length;
  const examples = (cleanText.match(EXAMPLE_PHRASES) || []).length;
  
  // Question openers (paragraphs starting with questions)
  const questionOpeners = paragraphs.filter(p => /^[^.!?]*\?/.test(p)).length;
  const questionOpenerRate = safeRatio(questionOpeners, paragraphCount);
  
  const transitionWordRate = safeRatio(transitions, sentenceCount);
  const exampleUsageRate = safeRatio(examples, sentenceCount);
  
  // List patterns (numbered or bulleted)
  const listIndicators = (cleanText.match(/^[\s]*[-•*]\s|^[\s]*\d+[.)]\s/gm) || []).length;
  const listUsageRate = safeRatio(listIndicators, paragraphCount);

  // Emphasis patterns
  const emphasisPatterns: string[] = [];
  if ((cleanText.match(/\*\*[^*]+\*\*/g) || []).length > 0) emphasisPatterns.push('bold-markdown');
  if ((cleanText.match(/\*[^*]+\*/g) || []).length > 0) emphasisPatterns.push('italic-markdown');
  if ((cleanText.match(/_[^_]+_/g) || []).length > 0) emphasisPatterns.push('underscore-emphasis');
  if ((cleanText.match(/[A-Z]{3,}/g) || []).length > 2) emphasisPatterns.push('all-caps');

  // ---- RETURN FINGERPRINT ----
  return {
    vocabulary: {
      uniqueWordCount: uniqueWords.size,
      avgWordLength: Math.round(avgWordLength * 100) / 100,
      complexWordRatio,
      contractionRatio,
      topWords,
      rarityScore,
    },
    rhythm: {
      avgSentenceLength: Math.round(avgSentenceLength * 100) / 100,
      sentenceVariation: Math.round(sentenceVariation * 100) / 100,
      shortSentenceRatio,
      longSentenceRatio,
      avgParagraphLength: Math.round(avgParagraphLength * 100) / 100,
      paragraphVariation: Math.round(paragraphVariation * 100) / 100,
    },
    punctuation: {
      exclamationRate: per100Sentences(exclamations),
      questionRate: per100Sentences(questions),
      semicolonRate: per100Sentences(semicolons),
      dashRate: per100Sentences(dashes),
      ellipsisRate: per100Sentences(ellipses),
      colonRate: per100Sentences(colons),
      commaRate: per100Words(commas),
    },
    voice: {
      hedgeDensity,
      qualifierDensity,
      assertiveDensity,
      personalPronounRate,
      formalityScore: Math.round(formalityScore * 100) / 100,
      activeVoiceRatio: Math.round(activeVoiceRatio * 100) / 100,
    },
    rhetoric: {
      questionOpenerRate,
      transitionWordRate,
      listUsageRate,
      exampleUsageRate,
      emphasisPatterns,
    },
    meta: {
      sampleWordCount: wordCount,
      sampleSentenceCount: sentenceCount,
      extractedAt: new Date().toISOString(),
      version: '1.0.0',
    },
  };
}

// ============================================
// HELPER: Get human-readable voice summary
// ============================================

export function describeVoice(fp: VoiceFingerprint): string {
  const traits: string[] = [];

  // Formality
  if (fp.voice.formalityScore > 0.7) {
    traits.push('formal and professional');
  } else if (fp.voice.formalityScore < 0.3) {
    traits.push('casual and conversational');
  } else {
    traits.push('balanced in formality');
  }

  // Sentence style
  if (fp.rhythm.avgSentenceLength > 20) {
    traits.push('uses longer, complex sentences');
  } else if (fp.rhythm.avgSentenceLength < 12) {
    traits.push('prefers short, punchy sentences');
  }

  // Variation
  if (fp.rhythm.sentenceVariation > 8) {
    traits.push('varies sentence length dynamically');
  }

  // Voice confidence
  if (fp.voice.hedgeDensity > 0.02) {
    traits.push('tends to hedge statements');
  } else if (fp.voice.assertiveDensity > 0.01) {
    traits.push('writes with confident assertions');
  }

  // Personal touch
  if (fp.voice.personalPronounRate > 0.05) {
    traits.push('writes with a personal, first-person perspective');
  }

  // Punctuation style
  if (fp.punctuation.exclamationRate > 5) {
    traits.push('expressive with exclamations');
  }
  if (fp.punctuation.questionRate > 10) {
    traits.push('engages readers with questions');
  }
  if (fp.punctuation.dashRate > 3) {
    traits.push('uses dashes for emphasis');
  }

  // Vocabulary
  if (fp.vocabulary.complexWordRatio > 0.15) {
    traits.push('employs sophisticated vocabulary');
  }
  if (fp.vocabulary.contractionRatio > 0.02) {
    traits.push('uses contractions naturally');
  }

  return traits.length > 0 
    ? `This voice is ${traits.join(', ')}.`
    : 'This voice has a neutral, standard style.';
}

// ============================================
// EXPORT DEFAULT
// ============================================

export default {
  extractVoiceFingerprint,
  describeVoice,
};