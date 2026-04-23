// src/app/api/mirror-mode/voice/learn/route.ts
// The orchestrator - called after document upload to trigger learning

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/getAuthUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Errors } from '@/lib/api/errors';
import { extractVoiceFingerprint, describeVoice } from '@/lib/mirror-core/voiceAnalysis';
import { mapWritingTypeToChamber } from '@/lib/mirror-core/writingTypes';
import {
  aggregateFingerprints,
  calculateConfidence,
  getConfidenceLabel,
  type VoiceProfile
} from '@/lib/mirror-core/voiceAggregation';
import {
  SOURCE_AUTHORITY,
  isProfileEligible,
  type SourceAuthority,
} from '@/lib/mirror-core/sourceAuthority';
import { shouldIngestForProfile } from '@/lib/mirror-core/ingestionPolicy';

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
    const rawSourceAuthority = String(body?.sourceAuthority || '').trim();
    const sourceAuthority: SourceAuthority =
      rawSourceAuthority === SOURCE_AUTHORITY.USER_TYPED ||
      rawSourceAuthority === SOURCE_AUTHORITY.USER_UPLOADED ||
      rawSourceAuthority === SOURCE_AUTHORITY.USER_QUICKSTART ||
      rawSourceAuthority === SOURCE_AUTHORITY.PLAYGROUND_CONVERSATION ||
      rawSourceAuthority === SOURCE_AUTHORITY.AI_GENERATED_ACCEPTED ||
      rawSourceAuthority === SOURCE_AUTHORITY.AI_GENERATED_REJECTED ||
      rawSourceAuthority === SOURCE_AUTHORITY.EXTENSION_CAPTURED ||
      rawSourceAuthority === SOURCE_AUTHORITY.UNKNOWN
        ? rawSourceAuthority
        : SOURCE_AUTHORITY.UNKNOWN;

    if (!documentId && !text) {
      return Errors.validationError('Either documentId or text is required');
    }

    // ---- GET DOCUMENT TEXT ----
    let extractedText: string;
    let writingType: string = 'general';
    let resolvedSourceAuthority: SourceAuthority = sourceAuthority;

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

      // Fetch writing type for chamber mapping
      const { data: docRow } = await supabase
        .from('mirror_documents')
        .select('writing_type, source_authority, excluded_from_profile')
        .eq('id', documentId)
        .maybeSingle();
      writingType = docRow?.writing_type || 'general';
      if (docRow?.source_authority) {
        resolvedSourceAuthority = docRow.source_authority as SourceAuthority;
      } else {
        resolvedSourceAuthority = SOURCE_AUTHORITY.USER_UPLOADED;
      }
      if (docRow?.excluded_from_profile === true || !isProfileEligible(resolvedSourceAuthority)) {
        return NextResponse.json(
          {
            success: true,
            learned: false,
            skipped: true,
            reason: `Source excluded from profile: ${resolvedSourceAuthority}`,
          },
          { status: 200 }
        );
      }
    }
    if (!documentId && !isProfileEligible(resolvedSourceAuthority)) {
      return NextResponse.json(
        {
          success: true,
          learned: false,
          skipped: true,
          reason: `Source excluded from profile: ${resolvedSourceAuthority}`,
        },
        { status: 200 }
      );
    }

    const wordCount = extractedText.trim().split(/\s+/).filter(Boolean).length;
    const ingestionDecision = shouldIngestForProfile(
      wordCount,
      resolvedSourceAuthority
    );
    if (!ingestionDecision.eligible) {
      return NextResponse.json(
        {
          success: true,
          learned: false,
          skipped: true,
          reason: ingestionDecision.reason,
        },
        { status: 200 }
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
      documentId || 'direct-text',
      {
        fileName: documentId ? 'Document' : 'Direct Text',
        writingType,
        wordCount,
      }
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

    // Best-effort chamber profile update
    try {
      const chamber = mapWritingTypeToChamber(writingType);
      const { data: existingChamberRow } = await supabase
        .from('voice_chambers')
        .select('*')
        .eq('user_id', userId)
        .eq('chamber', chamber)
        .maybeSingle();

      let existingChamberProfile: VoiceProfile | null = null;
      if (existingChamberRow) {
        existingChamberProfile = {
          userId: existingChamberRow.user_id,
          aggregateFingerprint: existingChamberRow.aggregate_fingerprint,
          confidenceLevel: existingChamberRow.confidence_level || 0,
          documentCount: existingChamberRow.document_count || 0,
          totalWordCount: existingChamberRow.total_word_count || 0,
          lastTrainedAt: existingChamberRow.last_trained_at || new Date().toISOString(),
          evolutionHistory: existingChamberRow.evolution_history || [],
        };
      }

      const updatedChamberProfile = aggregateFingerprints(
        existingChamberProfile,
        newFingerprint,
        documentId || 'direct-text',
        { fileName: documentId ? 'Document' : 'Direct Text', writingType, wordCount }
      );
      updatedChamberProfile.userId = userId;

      await supabase
        .from('voice_chambers')
        .upsert({
          user_id: userId,
          chamber,
          aggregate_fingerprint: updatedChamberProfile.aggregateFingerprint,
          confidence_level: updatedChamberProfile.confidenceLevel,
          document_count: updatedChamberProfile.documentCount,
          total_word_count: updatedChamberProfile.totalWordCount,
          last_trained_at: updatedChamberProfile.lastTrainedAt,
          evolution_history: updatedChamberProfile.evolutionHistory,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,chamber' });

      await supabase
        .from('voice_chambers')
        .upsert({
          user_id: userId,
          chamber: 'overall',
          aggregate_fingerprint: updatedProfile.aggregateFingerprint,
          confidence_level: updatedProfile.confidenceLevel,
          document_count: updatedProfile.documentCount,
          total_word_count: updatedProfile.totalWordCount,
          last_trained_at: updatedProfile.lastTrainedAt,
          evolution_history: updatedProfile.evolutionHistory,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,chamber' });
    } catch (err: any) {
      if (!String(err?.message || '').includes('does not exist')) {
        console.warn('Chamber profile update skipped:', err?.message || err);
      }
    }

    // ---- MARK DOCUMENT AS LEARNED (if documentId provided) ----
    if (documentId) {
      await supabase
        .from('mirror_documents')
        .update({
          learned_at: new Date().toISOString(),
          source_authority: resolvedSourceAuthority,
          excluded_from_profile: !isProfileEligible(resolvedSourceAuthority),
        })
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
