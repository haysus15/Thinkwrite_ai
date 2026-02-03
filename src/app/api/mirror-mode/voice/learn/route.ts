// src/app/api/mirror-mode/voice/learn/route.ts
// The orchestrator - called after document upload to trigger learning

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/getAuthUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Errors } from '@/lib/api/errors';
import { extractVoiceFingerprint, describeVoice } from '@/lib/mirror-mode/voiceAnalysis';
import {
  aggregateFingerprints,
  calculateConfidence,
  getConfidenceLabel,
  type VoiceProfile
} from '@/lib/mirror-mode/voiceAggregation';

export const runtime = 'nodejs';

/**
 * POST /api/mirror-mode/voice/learn
 *
 * Triggers voice learning from a document.
 * Can be called:
 *   1. After document upload (with documentId)
 *   2. With raw text (for testing)
 *
 * Request body:
 *   - documentId?: string (fetch text from mirror_document_content)
 *   - text?: string (direct text input for testing)
 */
export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return Errors.unauthorized();
    }

    const supabase = await createSupabaseServerClient();
    const body = await req.json();
    const { documentId, text } = body;

    if (!documentId && !text) {
      return Errors.validationError('Either documentId or text is required');
    }

    // ---- GET DOCUMENT TEXT ----
    let extractedText: string;

    if (text) {
      // Direct text input (for testing)
      extractedText = text;
    } else {
      // Fetch from mirror_document_content
      const { data: contentRow, error: contentError } = await supabase
        .from('mirror_document_content')
        .select('extracted_text')
        .eq('document_id', documentId)
        .single();

      if (contentError || !contentRow?.extracted_text) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Could not fetch document content',
            details: contentError?.message 
          },
          { status: 404 }
        );
      }

      extractedText = contentRow.extracted_text;
    }

    // ---- MINIMUM TEXT CHECK ----
    const wordCount = extractedText.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount < 50) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Document too short for voice learning',
          details: `Minimum 50 words required, got ${wordCount}` 
        },
        { status: 400 }
      );
    }

    // ---- EXTRACT FINGERPRINT ----
    const newFingerprint = extractVoiceFingerprint(extractedText);

    // ---- FETCH EXISTING PROFILE ----
    const { data: existingRow, error: profileError } = await supabase
      .from('voice_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    // Convert database row to VoiceProfile (or null if new user)
    let existingProfile: VoiceProfile | null = null;
    
    if (existingRow && !profileError) {
      existingProfile = {
        userId: existingRow.user_id,
        aggregateFingerprint: existingRow.aggregate_fingerprint,
        confidenceLevel: existingRow.confidence_level || 0,
        documentCount: existingRow.document_count || 0,
        totalWordCount: existingRow.total_word_count || 0,
        lastTrainedAt: existingRow.last_trained_at || new Date().toISOString(),
        evolutionHistory: existingRow.evolution_history || [],
      };
    }

    // ---- AGGREGATE (THE LEARNING) ----
    const updatedProfile = aggregateFingerprints(
      existingProfile,
      newFingerprint,
      documentId || 'direct-text'
    );

    // Set userId (needed for initial profile creation)
    updatedProfile.userId = userId;

    // ---- SAVE TO DATABASE ----
    const { error: upsertError } = await supabase
      .from('voice_profiles')
      .upsert({
        user_id: userId,
        aggregate_fingerprint: updatedProfile.aggregateFingerprint,
        confidence_level: updatedProfile.confidenceLevel,
        document_count: updatedProfile.documentCount,
        total_word_count: updatedProfile.totalWordCount,
        last_trained_at: updatedProfile.lastTrainedAt,
        evolution_history: updatedProfile.evolutionHistory,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      });

    if (upsertError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to save voice profile',
          details: upsertError.message 
        },
        { status: 500 }
      );
    }

    // ---- MARK DOCUMENT AS LEARNED (if documentId provided) ----
    if (documentId) {
      await supabase
        .from('mirror_documents')
        .update({ learned_at: new Date().toISOString() })
        .eq('id', documentId);
    }

    // ---- BUILD RESPONSE ----
    const isFirstDocument = !existingProfile;
    const confidenceGain = isFirstDocument 
      ? updatedProfile.confidenceLevel 
      : updatedProfile.confidenceLevel - existingProfile!.confidenceLevel;

    return NextResponse.json({
      success: true,
      message: isFirstDocument 
        ? 'Voice profile created! Ursie is starting to learn your style.'
        : 'Voice profile updated! Your writing DNA is getting stronger.',
      
      learning: {
        isFirstDocument,
        documentId: documentId || null,
        wordsAnalyzed: newFingerprint.meta.sampleWordCount,
        sentencesAnalyzed: newFingerprint.meta.sampleSentenceCount,
      },
      
      profile: {
        confidenceLevel: updatedProfile.confidenceLevel,
        confidenceLabel: getConfidenceLabel(updatedProfile.confidenceLevel),
        confidenceGain,
        documentCount: updatedProfile.documentCount,
        totalWordCount: updatedProfile.totalWordCount,
        lastTrainedAt: updatedProfile.lastTrainedAt,
      },

      voiceDescription: describeVoice(updatedProfile.aggregateFingerprint),
      
      // Last evolution entry (what changed)
      latestEvolution: updatedProfile.evolutionHistory.slice(-1)[0] || null,
    });

  } catch (error: any) {
    console.error('Voice learning error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Voice learning failed',
        details: error?.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}
