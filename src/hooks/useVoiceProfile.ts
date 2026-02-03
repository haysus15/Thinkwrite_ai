// src/hooks/useVoiceProfile.ts
// React hook for accessing voice profile in Career Studio (and other studios)

"use client";

import { useState, useEffect, useCallback } from "react";
import type { VoiceReadiness, VoiceProfileFull, StudioType } from "@/services/voice-profile/VoiceProfileService";

// ============================================================================
// TYPES
// ============================================================================

interface VoiceProfileState {
  isLoading: boolean;
  error: string | null;
  profile: VoiceProfileFull | null;
  readiness: VoiceReadiness | null;
  hasProfile: boolean;
}

interface UseVoiceProfileOptions {
  studioType?: StudioType;
  autoFetch?: boolean;
}

interface UseVoiceProfileReturn extends VoiceProfileState {
  refetch: () => Promise<void>;
  getPromptInjection: () => string;
}

// ============================================================================
// API FETCHERS
// ============================================================================

async function fetchVoiceProfile(): Promise<{
  profile: VoiceProfileFull | null;
  exists: boolean;
}> {
  const res = await fetch("/api/mirror-mode/voice/profile?includeFingerprint=true", {
    cache: "no-store",
    headers: {
      "Cache-Control": "no-cache",
    },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch voice profile");
  }

  const data = await res.json();

  if (!data.success) {
    throw new Error(data.error || "Unknown error");
  }

  if (!data.exists) {
    return { profile: null, exists: false };
  }

  // Transform API response to VoiceProfileFull
  const profile: VoiceProfileFull = {
    userId: data.profile.userId,
    profileId: data.profile.userId, // API doesn't return profileId, use userId
    confidenceLevel: data.profile.confidenceLevel,
    confidenceLabel: data.profile.confidenceLabel,
    documentCount: data.profile.documentCount,
    totalWordCount: data.profile.totalWordCount,
    lastTrainedAt: data.profile.lastTrainedAt,
    createdAt: data.profile.createdAt,
    updatedAt: data.profile.updatedAt,
    fingerprint: data.fingerprint,
    voiceDescription: data.voiceDescription,
    voiceSummary: data.voiceSummary,
    evolutionHistory: data.evolutionHistory || [],
  };

  return { profile, exists: true };
}

// ============================================================================
// READINESS ASSESSMENT (CLIENT-SIDE MIRROR)
// ============================================================================

type ConfidenceTier = 'none' | 'developing' | 'emerging' | 'established' | 'strong';

function getConfidenceTier(score: number): ConfidenceTier {
  if (score === 0) return 'none';
  if (score < 40) return 'developing';
  if (score < 65) return 'emerging';
  if (score < 85) return 'established';
  return 'strong';
}

function assessReadinessClient(profile: VoiceProfileFull | null): VoiceReadiness {
  if (!profile) {
    return {
      tier: 'none',
      score: 0,
      isReady: false,
      canGenerate: true,
      shouldWarn: true,
      shouldEncourage: true,
      message: "No voice profile yet. Content will use standard AI tone.",
      lexMessage: "I don't know your writing style yet, so this will sound like generic AI. Want to set up Mirror Mode first so I can write like you?",
    };
  }

  const score = profile.confidenceLevel;
  const tier = getConfidenceTier(score);

  switch (tier) {
    case 'developing':
      return {
        tier,
        score,
        isReady: false,
        canGenerate: true,
        shouldWarn: true,
        shouldEncourage: true,
        message: `Voice profile at ${score}%. Need more writing samples for accuracy.`,
        lexMessage: `I'm still learning your style (${score}% confidence). I'll do my best, but upload a few more documents to Mirror Mode and I'll sound much more like you.`,
      };

    case 'emerging':
      return {
        tier,
        score,
        isReady: true,
        canGenerate: true,
        shouldWarn: true,
        shouldEncourage: true,
        message: `Voice profile at ${score}%. Getting closer to your authentic style.`,
        lexMessage: `I've got a decent read on your style (${score}% confidence). Let me know if this sounds like you - your feedback helps me improve. More writing samples would sharpen things further.`,
      };

    case 'established':
      return {
        tier,
        score,
        isReady: true,
        canGenerate: true,
        shouldWarn: false,
        shouldEncourage: false,
        message: `Voice profile at ${score}%. Writing in your established style.`,
        lexMessage: `I know your style well (${score}% confidence). This should sound like you wrote it.`,
      };

    case 'strong':
      return {
        tier,
        score,
        isReady: true,
        canGenerate: true,
        shouldWarn: false,
        shouldEncourage: false,
        message: `Voice profile at ${score}%. Writing in your authentic voice.`,
        lexMessage: `I've got your voice down (${score}% confidence). This will sound like you.`,
      };

    default:
      return {
        tier: 'none',
        score: 0,
        isReady: false,
        canGenerate: true,
        shouldWarn: true,
        shouldEncourage: true,
        message: "Unable to assess voice profile.",
        lexMessage: "Something's off with your voice profile. Let's use standard formatting for now.",
      };
  }
}

// ============================================================================
// MAIN HOOK
// ============================================================================

export function useVoiceProfile(
  options: UseVoiceProfileOptions = {}
): UseVoiceProfileReturn {
  const { studioType = 'career', autoFetch = true } = options;

  const [state, setState] = useState<VoiceProfileState>({
    isLoading: true,
    error: null,
    profile: null,
    readiness: null,
    hasProfile: false,
  });

  const fetchProfile = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const { profile, exists } = await fetchVoiceProfile();
      const readiness = assessReadinessClient(profile);

      setState({
        isLoading: false,
        error: null,
        profile,
        readiness,
        hasProfile: exists,
      });
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err.message || "Failed to load voice profile",
      }));
    }
  }, []);

  useEffect(() => {
    if (autoFetch) {
      fetchProfile();
    }
  }, [autoFetch, fetchProfile]);

  // Build prompt injection based on current profile
  const getPromptInjection = useCallback((): string => {
    const { profile, readiness } = state;

    if (!profile || !readiness?.isReady) {
      return getGenericInstruction(studioType);
    }

    return buildClientPromptInjection(profile, readiness, studioType);
  }, [state, studioType]);

  return {
    ...state,
    refetch: fetchProfile,
    getPromptInjection,
  };
}

// ============================================================================
// CLIENT-SIDE PROMPT BUILDERS
// ============================================================================

function getGenericInstruction(studioType: StudioType): string {
  switch (studioType) {
    case 'career':
      return `Write in a professional, polished tone suitable for career documents. Be clear, confident, and action-oriented. Note: No personalized voice profile is available, so this will use standard professional formatting.`;
    case 'academic':
      return `Write in a clear, scholarly tone appropriate for academic work. Be precise and well-structured. Note: No personalized voice profile is available.`;
    case 'creative':
      return `Write in an engaging, expressive style. Note: No personalized voice profile is available.`;
    default:
      return `Write clearly and professionally. Note: No personalized voice profile is available.`;
  }
}

function buildClientPromptInjection(
  profile: VoiceProfileFull,
  readiness: VoiceReadiness,
  studioType: StudioType
): string {
  const fp = profile.fingerprint;
  const parts: string[] = [];

  parts.push(`Write in the user's authentic voice. Here is their writing DNA:`);
  parts.push('');

  // Sentence structure
  if (fp.rhythm.avgSentenceLength > 20) {
    parts.push(`- Use longer, flowing sentences (avg ${Math.round(fp.rhythm.avgSentenceLength)} words)`);
  } else if (fp.rhythm.avgSentenceLength < 12) {
    parts.push(`- Use short, punchy sentences (avg ${Math.round(fp.rhythm.avgSentenceLength)} words)`);
  } else {
    parts.push(`- Use medium-length sentences (avg ${Math.round(fp.rhythm.avgSentenceLength)} words)`);
  }

  // Formality
  if (fp.voice.formalityScore > 0.65) {
    parts.push(`- Maintain formal, professional tone`);
  } else if (fp.voice.formalityScore < 0.35) {
    parts.push(`- Use casual, conversational tone`);
  } else {
    parts.push(`- Balance professional and approachable tone`);
  }

  // Contractions
  if (fp.vocabulary.contractionRatio > 0.02) {
    parts.push(`- Use contractions naturally (don't, won't, I'm, etc.)`);
  } else if (fp.vocabulary.contractionRatio < 0.005) {
    parts.push(`- Avoid contractions (use "do not" instead of "don't")`);
  }

  // Confidence/hedging
  if (fp.voice.hedgeDensity > 0.015) {
    parts.push(`- Include qualifiers and hedging language where appropriate`);
  } else if (fp.voice.assertiveDensity > 0.008) {
    parts.push(`- Be direct and assertive, avoid hedging`);
  }

  // Personal pronouns
  if (fp.voice.personalPronounRate > 0.04) {
    parts.push(`- Write from first-person perspective`);
  }

  // Vocabulary complexity
  if (fp.vocabulary.complexWordRatio > 0.18) {
    parts.push(`- Use sophisticated, precise vocabulary`);
  } else if (fp.vocabulary.complexWordRatio < 0.08) {
    parts.push(`- Use clear, accessible language`);
  }

  // Punctuation patterns
  if (fp.punctuation.dashRate > 4) {
    parts.push(`- Use dashes for emphasis and asides`);
  }
  if (fp.punctuation.questionRate > 8) {
    parts.push(`- Incorporate rhetorical questions`);
  }

  // Transitions
  if (fp.rhetoric.transitionWordRate > 0.15) {
    parts.push(`- Connect ideas with clear transitions`);
  }

  // Studio-specific note
  parts.push('');
  if (studioType === 'career') {
    parts.push(`For this career content: Maintain professionalism while preserving the user's natural voice.`);
  }

  // Confidence caveat
  if (readiness.tier === 'emerging') {
    parts.push('');
    parts.push(`Note: Voice confidence is ${readiness.score}%. Aim for this style but prioritize clarity.`);
  }

  return parts.join('\n');
}

// ============================================================================
// ADDITIONAL UTILITY HOOKS
// ============================================================================

/**
 * Lightweight hook just for checking if voice profile exists
 */
export function useHasVoiceProfile(): {
  hasProfile: boolean;
  isLoading: boolean;
} {
  const [hasProfile, setHasProfile] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/mirror-mode/voice/profile?includeFingerprint=false", {
      cache: "no-store",
    })
      .then((res) => res.json())
      .then((data) => {
        setHasProfile(data.exists === true);
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, []);

  return { hasProfile, isLoading };
}

/**
 * Hook for just the confidence score
 */
export function useVoiceConfidence(): {
  confidence: number;
  tier: ConfidenceTier;
  isLoading: boolean;
} {
  const [confidence, setConfidence] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/mirror-mode/voice/profile?includeFingerprint=false", {
      cache: "no-store",
    })
      .then((res) => res.json())
      .then((data) => {
        setConfidence(data.profile?.confidenceLevel ?? 0);
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, []);

  return {
    confidence,
    tier: getConfidenceTier(confidence),
    isLoading,
  };
}