// Voice Injection Utility for Career Studio
// src/lib/mirror-mode/voiceInjection.ts
// Fetches voice profile and formats it for Claude prompts

import { createClient } from '@supabase/supabase-js';

export interface VoiceInjectionResult {
  hasVoice: boolean;
  confidenceLevel: number;
  confidenceLabel: string;
  voiceSummary: string;
  voiceDescription: string;
  promptSection: string;
  promptWeight: 'none' | 'light' | 'medium' | 'full';
}

export interface VoiceInjectionOptions {
  minConfidence?: number;
  includePromptSection?: boolean;
}

// Confidence tier labels
const CONFIDENCE_LABELS: Record<string, { min: number; max: number; label: string }> = {
  initializing: { min: 0, max: 24, label: 'Initializing' },
  learning: { min: 25, max: 44, label: 'Learning' },
  developing: { min: 45, max: 64, label: 'Developing' },
  confident: { min: 65, max: 84, label: 'Confident' },
  mastered: { min: 85, max: 100, label: 'Mastered' },
};

/**
 * Get confidence label from numeric confidence
 */
export function getConfidenceLabel(confidence: number): string {
  for (const tier of Object.values(CONFIDENCE_LABELS)) {
    if (confidence >= tier.min && confidence <= tier.max) {
      return tier.label;
    }
  }
  return 'Unknown';
}

/**
 * Determine if voice should be used and at what weight
 */
export function shouldUseVoiceProfile(confidence: number): {
  useVoice: boolean;
  promptWeight: 'none' | 'light' | 'medium' | 'full';
  userMessage?: string;
} {
  if (confidence < 25) {
    return {
      useVoice: false,
      promptWeight: 'none',
      userMessage: 'Still learning your writing style. Upload more documents to Mirror Mode for personalized content.',
    };
  }
  if (confidence < 45) {
    return { useVoice: true, promptWeight: 'light' };
  }
  if (confidence < 65) {
    return { useVoice: true, promptWeight: 'medium' };
  }
  return { useVoice: true, promptWeight: 'full' };
}

/**
 * Build voice summary from fingerprint
 */
function buildVoiceSummary(fingerprint: any): string {
  if (!fingerprint) return '';

  const summaryParts: string[] = [];

  // Rhythm/sentence structure
  if (fingerprint.rhythm) {
    const avgLen = fingerprint.rhythm.avgSentenceLength || 0;
    if (avgLen < 12) {
      summaryParts.push('Uses short, punchy sentences');
    } else if (avgLen > 20) {
      summaryParts.push('Prefers longer, detailed sentences');
    } else {
      summaryParts.push('Uses moderate sentence lengths');
    }
  }

  // Vocabulary
  if (fingerprint.vocabulary) {
    if (fingerprint.vocabulary.contractionRatio > 0.02) {
      summaryParts.push('Uses contractions naturally');
    } else {
      summaryParts.push('Tends to avoid contractions');
    }

    if (fingerprint.vocabulary.complexWordRatio > 0.15) {
      summaryParts.push('Employs sophisticated vocabulary');
    } else if (fingerprint.vocabulary.complexWordRatio < 0.08) {
      summaryParts.push('Prefers accessible language');
    }
  }

  // Voice/tone
  if (fingerprint.voice) {
    if (fingerprint.voice.formalityScore > 0.6) {
      summaryParts.push('Maintains formal, professional tone');
    } else if (fingerprint.voice.formalityScore < 0.4) {
      summaryParts.push('Has a conversational, approachable style');
    }

    if (fingerprint.voice.personalPronounRate > 0.04) {
      summaryParts.push('Writes with personal perspective (uses "I", "my")');
    }

    if (fingerprint.voice.assertiveDensity > 0.02) {
      summaryParts.push('Communicates with confidence and certainty');
    }
  }

  // Punctuation habits
  if (fingerprint.punctuation) {
    if (fingerprint.punctuation.dashRate > 0.01) {
      summaryParts.push('Uses dashes for emphasis or asides');
    }
    if (fingerprint.punctuation.exclamationRate > 0.02) {
      summaryParts.push('Occasionally uses exclamation points');
    }
  }

  return summaryParts.join('. ') + (summaryParts.length > 0 ? '.' : '');
}

/**
 * Build the prompt section for Claude
 */
export function buildVoicePromptSection(
  voiceSummary: string,
  confidenceLabel: string,
  promptWeight: 'none' | 'light' | 'medium' | 'full'
): string {
  if (promptWeight === 'none' || !voiceSummary) {
    return '';
  }

  const intro = {
    light: 'Consider the user\'s general writing style:',
    medium: 'Write in the user\'s voice based on their writing samples:',
    full: 'You MUST match the user\'s authentic writing style:',
  }[promptWeight];

  const guidelines = promptWeight === 'full' ? `
Guidelines:
- Match their sentence structure preferences exactly
- Use their typical vocabulary level
- Mirror their tone and formality
- Apply their punctuation habits naturally
- Maintain their characteristic voice throughout` : '';

  return `
## WRITE IN THE USER'S AUTHENTIC VOICE
${intro}
${voiceSummary}
${guidelines}
Voice Confidence: ${confidenceLabel}
`;
}

/**
 * Main function: Fetch voice profile and format for generation
 */
export async function getVoiceForGeneration(
  userId: string,
  options: VoiceInjectionOptions = {}
): Promise<VoiceInjectionResult> {
  const { minConfidence = 25, includePromptSection = true } = options;

  const defaultResult: VoiceInjectionResult = {
    hasVoice: false,
    confidenceLevel: 0,
    confidenceLabel: 'Not Started',
    voiceSummary: '',
    voiceDescription: '',
    promptSection: '',
    promptWeight: 'none',
  };

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: profile, error } = await supabase
      .from('voice_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !profile) {
      return defaultResult;
    }

    const confidenceLevel = Math.round((profile.confidence_level || 0) * 100);
    const confidenceLabel = getConfidenceLabel(confidenceLevel);
    const { useVoice, promptWeight } = shouldUseVoiceProfile(confidenceLevel);

    if (!useVoice || confidenceLevel < minConfidence) {
      return {
        ...defaultResult,
        confidenceLevel,
        confidenceLabel,
      };
    }

    const fingerprint = profile.aggregate_fingerprint;
    const voiceSummary = buildVoiceSummary(fingerprint);

    // Build human-readable description
    const voiceDescription = voiceSummary || 'Voice profile is being developed';

    const promptSection = includePromptSection
      ? buildVoicePromptSection(voiceSummary, confidenceLabel, promptWeight)
      : '';

    return {
      hasVoice: true,
      confidenceLevel,
      confidenceLabel,
      voiceSummary,
      voiceDescription,
      promptSection,
      promptWeight,
    };
  } catch (error) {
    console.error('Error fetching voice profile:', error);
    return defaultResult;
  }
}

/**
 * Quick check if user has a voice profile (lighter than full fetch)
 */
export async function hasVoiceProfile(userId: string): Promise<{
  exists: boolean;
  confidenceLevel: number;
  confidenceLabel: string;
  documentCount: number;
}> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: profile, error } = await supabase
      .from('voice_profiles')
      .select('confidence_level, document_count')
      .eq('user_id', userId)
      .single();

    if (error || !profile) {
      return {
        exists: false,
        confidenceLevel: 0,
        confidenceLabel: 'Not Started',
        documentCount: 0,
      };
    }

    const confidenceLevel = Math.round((profile.confidence_level || 0) * 100);

    return {
      exists: true,
      confidenceLevel,
      confidenceLabel: getConfidenceLabel(confidenceLevel),
      documentCount: profile.document_count || 0,
    };
  } catch (error) {
    console.error('Error checking voice profile:', error);
    return {
      exists: false,
      confidenceLevel: 0,
      confidenceLabel: 'Error',
      documentCount: 0,
    };
  }
}
