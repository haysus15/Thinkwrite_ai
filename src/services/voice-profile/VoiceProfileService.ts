// src/services/voice-profile/VoiceProfileService.ts
// Centralized Voice Profile Service for all Studios

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { describeVoice, type VoiceFingerprint } from "@/lib/mirror-mode/voiceAnalysis";
import { getConfidenceLabel } from "@/lib/mirror-mode/voiceAggregation";

// ============================================================================
// TYPES
// ============================================================================

export interface VoiceProfile {
  userId: string;
  profileId: string;
  confidenceLevel: number;
  confidenceLabel: string;
  documentCount: number;
  totalWordCount: number;
  lastTrainedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VoiceProfileFull extends VoiceProfile {
  fingerprint: VoiceFingerprint;
  voiceDescription: string;
  voiceSummary: string;
  evolutionHistory?: any[];
}

export type ConfidenceTier = 'none' | 'developing' | 'emerging' | 'established' | 'strong';

export interface VoiceReadiness {
  tier: ConfidenceTier;
  score: number;
  isReady: boolean;           // Can generate with voice
  canGenerate: boolean;       // Can generate at all (always true per Trent's decision)
  shouldWarn: boolean;        // Show warning about voice quality
  shouldEncourage: boolean;   // Prompt user to upload more docs
  message: string;            // User-facing message
  lexMessage: string;         // What Lex (Career Studio persona) should say
}

export interface VoiceGenerationContext {
  hasVoiceProfile: boolean;
  readiness: VoiceReadiness;
  profile: VoiceProfileFull | null;
  
  // Pre-built prompt injection for Claude/OpenAI
  promptInjection: string;
}

export type StudioType = 'career' | 'academic' | 'creative';

// ============================================================================
// CONFIDENCE TIERS
// ============================================================================

const CONFIDENCE_TIERS: Record<ConfidenceTier, { min: number; max: number }> = {
  none: { min: 0, max: 0 },
  developing: { min: 1, max: 39 },
  emerging: { min: 40, max: 64 },
  established: { min: 65, max: 84 },
  strong: { min: 85, max: 100 },
};

function getConfidenceTier(score: number): ConfidenceTier {
  if (score === 0) return 'none';
  if (score < 40) return 'developing';
  if (score < 65) return 'emerging';
  if (score < 85) return 'established';
  return 'strong';
}

// ============================================================================
// VOICE READINESS ASSESSMENT
// ============================================================================

function assessVoiceReadiness(profile: VoiceProfileFull | null): VoiceReadiness {
  // No profile at all
  if (!profile) {
    return {
      tier: 'none',
      score: 0,
      isReady: false,
      canGenerate: true,  // Users can always generate
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
        isReady: true,  // Can use voice, but with caveats
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
// PROMPT INJECTION BUILDER
// ============================================================================

function buildPromptInjection(
  profile: VoiceProfileFull | null,
  readiness: VoiceReadiness,
  studioType: StudioType
): string {
  // No profile or not ready - return generic instruction
  if (!profile || !readiness.isReady) {
    return getGenericStyleInstruction(studioType);
  }

  const fp = profile.fingerprint;
  const parts: string[] = [];

  // Base instruction
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

  // Studio-specific adjustments
  parts.push('');
  parts.push(getStudioSpecificInstruction(studioType, fp));

  // Confidence caveat if emerging
  if (readiness.tier === 'emerging') {
    parts.push('');
    parts.push(`Note: Voice confidence is ${readiness.score}%. Aim for this style but prioritize clarity.`);
  }

  return parts.join('\n');
}

function getGenericStyleInstruction(studioType: StudioType): string {
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

function getStudioSpecificInstruction(studioType: StudioType, fp: VoiceFingerprint): string {
  switch (studioType) {
    case 'career':
      // Career content should lean slightly more formal regardless of base style
      return `For this career content: Maintain professionalism while preserving the user's natural voice. If their style is very casual, dial formality up slightly for professional contexts while keeping their authentic patterns.`;
    
    case 'academic':
      // Academic should respect voice but enforce structure
      return `For this academic content: Preserve the user's voice while ensuring scholarly rigor. Maintain their sentence patterns but adjust vocabulary for academic precision.`;
    
    case 'creative':
      // Creative should fully embrace their voice
      return `For this creative content: Fully embrace the user's natural voice. Let their personality shine through without constraints.`;
    
    default:
      return '';
  }
}

// ============================================================================
// MAIN SERVICE CLASS
// ============================================================================

export class VoiceProfileService {
  
  /**
   * Get full voice profile for a user
   */
  static async getProfile(userId: string): Promise<VoiceProfileFull | null> {
    const supabase = await createSupabaseServerClient();
    
    const { data: profile, error } = await supabase
      .from("voice_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !profile) {
      return null;
    }

    const fingerprint = profile.aggregate_fingerprint as VoiceFingerprint;

    return {
      userId: profile.user_id,
      profileId: profile.id,
      confidenceLevel: profile.confidence_level,
      confidenceLabel: getConfidenceLabel(profile.confidence_level),
      documentCount: profile.document_count,
      totalWordCount: profile.total_word_count,
      lastTrainedAt: profile.last_trained_at,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
      fingerprint,
      voiceDescription: describeVoice(fingerprint),
      voiceSummary: buildVoiceSummary(fingerprint),
      evolutionHistory: profile.evolution_history || [],
    };
  }

  /**
   * Get voice readiness assessment
   */
  static async getReadiness(userId: string): Promise<VoiceReadiness> {
    const profile = await this.getProfile(userId);
    return assessVoiceReadiness(profile);
  }

  /**
   * Get complete generation context for a studio
   * This is the main method studios should call before generating content
   */
  static async getGenerationContext(
    userId: string,
    studioType: StudioType
  ): Promise<VoiceGenerationContext> {
    const profile = await this.getProfile(userId);
    const readiness = assessVoiceReadiness(profile);
    const promptInjection = buildPromptInjection(profile, readiness, studioType);

    return {
      hasVoiceProfile: !!profile,
      readiness,
      profile,
      promptInjection,
    };
  }

  /**
   * Quick check if user has any voice profile
   */
  static async hasProfile(userId: string): Promise<boolean> {
    const supabase = await createSupabaseServerClient();
    
    const { count } = await supabase
      .from("voice_profiles")
      .select("id", { count: 'exact', head: true })
      .eq("user_id", userId);

    return (count ?? 0) > 0;
  }

  /**
   * Get just the confidence score (lightweight check)
   */
  static async getConfidenceScore(userId: string): Promise<number> {
    const supabase = await createSupabaseServerClient();
    
    const { data } = await supabase
      .from("voice_profiles")
      .select("confidence_level")
      .eq("user_id", userId)
      .maybeSingle();

    return data?.confidence_level ?? 0;
  }
}

// ============================================================================
// HELPER FUNCTIONS (exported for use elsewhere)
// ============================================================================

function buildVoiceSummary(fp: VoiceFingerprint): string {
  const traits: string[] = [];

  if (fp.rhythm.avgSentenceLength > 20) traits.push("prefers longer, flowing sentences");
  else if (fp.rhythm.avgSentenceLength < 12) traits.push("writes in short, punchy sentences");
  else traits.push("uses medium-length sentences");

  if (fp.voice.formalityScore > 0.65) traits.push("formal tone");
  else if (fp.voice.formalityScore < 0.35) traits.push("casual, conversational tone");

  if (fp.vocabulary.contractionRatio > 0.02) traits.push("uses contractions freely");
  else if (fp.vocabulary.contractionRatio < 0.005) traits.push("avoids contractions");

  if (fp.voice.hedgeDensity > 0.015) traits.push("tends to hedge and qualify statements");
  else if (fp.voice.assertiveDensity > 0.008) traits.push("makes confident, direct assertions");

  if (fp.voice.personalPronounRate > 0.04) traits.push("writes with a personal, first-person perspective");

  if (fp.vocabulary.complexWordRatio > 0.18) traits.push("uses sophisticated vocabulary");
  else if (fp.vocabulary.complexWordRatio < 0.08) traits.push("prefers simple, accessible language");

  if (fp.punctuation.dashRate > 4) traits.push("uses dashes for emphasis");
  if (fp.punctuation.questionRate > 8) traits.push("frequently poses questions");
  if (fp.punctuation.exclamationRate > 3) traits.push("uses exclamation marks expressively");

  if (fp.rhetoric.transitionWordRate > 0.15) traits.push("connects ideas with transition words");

  return traits.length ? traits.join("; ") + "." : "Standard, neutral writing style.";
}

export { buildVoiceSummary, getConfidenceTier, assessVoiceReadiness };