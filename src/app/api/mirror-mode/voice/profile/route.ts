// Voice Profile API Route
// src/app/api/mirror-mode/voice/profile/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, createSupabaseAdmin } from '@/lib/auth/getAuthUser';
import { Errors } from '@/lib/api/errors';
import { describeVoice, type VoiceFingerprint } from '@/lib/mirror-mode/voiceAnalysis';
import { getConfidenceLabel } from '@/lib/mirror-mode/voiceAggregation';

export const runtime = 'nodejs';

/**
 * GET /api/mirror-mode/voice/profile
 *
 * Returns the authenticated user's current voice profile.
 * Used by other studios to generate content in the user's authentic voice.
 *
 * Query params:
 *   - includeFingerprint: boolean (default: true) - include full fingerprint data
 *   - includeEvolution: boolean (default: false) - include evolution history
 */
export async function GET(req: NextRequest) {
  try {
    // Authenticate user
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return Errors.unauthorized();
    }

    const { searchParams } = new URL(req.url);
    const includeFingerprint = searchParams.get('includeFingerprint') !== 'false';
    const includeEvolution = searchParams.get('includeEvolution') === 'true';

    const supabase = createSupabaseAdmin();

    // Fetch profile
    const { data: profile, error } = await supabase
      .from('voice_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !profile) {
      // No profile yet - user hasn't uploaded any documents
      return NextResponse.json({
        success: true,
        exists: false,
        message: 'No voice profile yet. Upload documents to start learning your style.',
        profile: null,
      });
    }

    // Build response
    const fingerprint = profile.aggregate_fingerprint as VoiceFingerprint;

    const response: any = {
      success: true,
      exists: true,

      // Core profile info
      profile: {
        userId: profile.user_id,
        confidenceLevel: profile.confidence_level,
        confidenceLabel: getConfidenceLabel(profile.confidence_level),
        documentCount: profile.document_count,
        totalWordCount: profile.total_word_count,
        lastTrainedAt: profile.last_trained_at,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at,
      },

      // Human-readable description
      voiceDescription: describeVoice(fingerprint),

      // Quick summary for AI prompts
      voiceSummary: buildVoiceSummary(fingerprint),
    };

    // Include full fingerprint if requested
    if (includeFingerprint) {
      response.fingerprint = fingerprint;
    }

    // Include evolution history if requested
    if (includeEvolution) {
      response.evolutionHistory = profile.evolution_history || [];
    }

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('[Voice profile GET]:', error?.message);
    return Errors.internal();
  }
}

/**
 * Build a concise summary of voice characteristics for AI prompts
 */
function buildVoiceSummary(fp: VoiceFingerprint): string {
  const traits: string[] = [];

  // Sentence length preference
  if (fp.rhythm.avgSentenceLength > 20) {
    traits.push('prefers longer, flowing sentences');
  } else if (fp.rhythm.avgSentenceLength < 12) {
    traits.push('writes in short, punchy sentences');
  } else {
    traits.push('uses medium-length sentences');
  }

  // Formality
  if (fp.voice.formalityScore > 0.65) {
    traits.push('formal tone');
  } else if (fp.voice.formalityScore < 0.35) {
    traits.push('casual, conversational tone');
  }

  // Contractions
  if (fp.vocabulary.contractionRatio > 0.02) {
    traits.push('uses contractions freely');
  } else if (fp.vocabulary.contractionRatio < 0.005) {
    traits.push('avoids contractions');
  }

  // Hedging style
  if (fp.voice.hedgeDensity > 0.015) {
    traits.push('tends to hedge and qualify statements');
  } else if (fp.voice.assertiveDensity > 0.008) {
    traits.push('makes confident, direct assertions');
  }

  // Personal voice
  if (fp.voice.personalPronounRate > 0.04) {
    traits.push('writes with a personal, first-person perspective');
  }

  // Vocabulary complexity
  if (fp.vocabulary.complexWordRatio > 0.18) {
    traits.push('uses sophisticated vocabulary');
  } else if (fp.vocabulary.complexWordRatio < 0.08) {
    traits.push('prefers simple, accessible language');
  }

  // Punctuation quirks
  if (fp.punctuation.dashRate > 4) {
    traits.push('uses dashes for emphasis');
  }
  if (fp.punctuation.questionRate > 8) {
    traits.push('frequently poses questions');
  }
  if (fp.punctuation.exclamationRate > 3) {
    traits.push('uses exclamation marks expressively');
  }

  // Transitions
  if (fp.rhetoric.transitionWordRate > 0.15) {
    traits.push('connects ideas with transition words');
  }

  // Build the summary
  if (traits.length === 0) {
    return 'Standard, neutral writing style.';
  }

  return traits.join('; ') + '.';
}

/**
 * DELETE /api/mirror-mode/voice/profile
 *
 * Reset/delete the authenticated user's voice profile
 */
export async function DELETE(req: NextRequest) {
  try {
    // Authenticate user
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return Errors.unauthorized();
    }

    const supabase = createSupabaseAdmin();

    const { error } = await supabase
      .from('voice_profiles')
      .delete()
      .eq('user_id', userId);

    if (error) {
      return Errors.databaseError(error.message);
    }

    // Also reset learned_at on all user's documents
    await supabase
      .from('mirror_documents')
      .update({ learned_at: null })
      .eq('user_id', userId);

    return NextResponse.json({
      success: true,
      message: 'Voice profile deleted. Upload documents to start fresh.',
    });

  } catch (error: any) {
    console.error('[Voice profile DELETE]:', error?.message);
    return Errors.internal();
  }
}
