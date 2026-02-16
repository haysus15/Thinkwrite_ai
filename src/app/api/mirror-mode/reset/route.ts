// src/app/api/mirror-mode/reset/route.ts
// POST endpoint for epoch-based reset (no hard deletes)

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const now = new Date().toISOString();

    // ---- ARCHIVE CURRENT EPOCH ----
    const { data: profile } = await supabase
      .from('voice_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    const { data: currentEpochRow } = await supabase
      .from('voice_profile_epochs')
      .select('id, epoch_number, started_at')
      .eq('user_id', user.id)
      .is('ended_at', null)
      .order('epoch_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    const currentEpochNumber = currentEpochRow?.epoch_number || 1;

    let chambersSnapshot: any[] = [];
    try {
      const { data: chamberRows } = await supabase
        .from('voice_profiles_chambers')
        .select('*')
        .eq('user_id', user.id);
      chambersSnapshot = chamberRows || [];
    } catch {
      chambersSnapshot = [];
    }

    const archivedProfileData = {
      archivedAt: now,
      profile,
      chambers: chambersSnapshot,
    };

    if (currentEpochRow) {
      await supabase
        .from('voice_profile_epochs')
        .update({
          ended_at: now,
          archived_profile_data: archivedProfileData,
          reason: 'user_reset',
        })
        .eq('id', currentEpochRow.id);
    } else {
      // If no epoch exists, create and immediately close the first epoch
      await supabase
        .from('voice_profile_epochs')
        .insert({
          user_id: user.id,
          epoch_number: currentEpochNumber,
          started_at: profile?.created_at || now,
          ended_at: now,
          archived_profile_data: archivedProfileData,
          reason: 'user_reset',
        });
    }

    // ---- START NEW EPOCH ----
    await supabase
      .from('voice_profile_epochs')
      .insert({
        user_id: user.id,
        epoch_number: currentEpochNumber + 1,
        started_at: now,
      });

    // ---- HIDE CURRENT DOCUMENTS (NO HARD DELETE) ----
    const { error: docsHideError } = await supabase
      .from('mirror_documents')
      .update({
        deleted_at: now,
        visibility_status: 'hidden',
        epoch_number: currentEpochNumber,
      })
      .eq('user_id', user.id);

    if (docsHideError) {
      console.error('Documents hide error:', docsHideError);
      return NextResponse.json(
        { error: 'Failed to hide documents (schema upgrade required?)' },
        { status: 500 }
      );
    }

    // 5. Reset voice profile to initial state (current schema)
    const emptyFingerprint = {
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
        shortSentenceRatio: 0,
        longSentenceRatio: 0,
        sentenceLengthVariance: 0,
      },
      punctuation: {
        commaDensity: 0,
        periodDensity: 0,
        semicolonDensity: 0,
        colonDensity: 0,
        dashDensity: 0,
        ellipsisDensity: 0,
        exclamationDensity: 0,
        questionDensity: 0,
        quoteDensity: 0,
      },
      voice: {
        activeVoiceRatio: 0,
        passiveVoiceRatio: 0,
        hedgeDensity: 0,
        assertiveDensity: 0,
        personalPronounRate: 0,
        formalityScore: 0,
      },
      rhetoric: {
        structureScore: 0,
        clarityScore: 0,
        emphasisPatterns: [],
      },
      meta: {
        sampleWordCount: 0,
        sampleSentenceCount: 0,
        extractedAt: new Date().toISOString(),
        version: '1.0.0',
      },
    };

    const { error: profileError } = await supabase
      .from('voice_profiles')
      .update({
        aggregate_fingerprint: emptyFingerprint,
        confidence_level: 0,
        document_count: 0,
        total_word_count: 0,
        last_trained_at: null,
        evolution_history: [],
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (profileError) {
      console.error('Profile reset error:', profileError);
      return NextResponse.json(
        { error: 'Failed to reset voice profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      message: 'Voice profile has been reset',
      newEpoch: currentEpochNumber + 1
    });

  } catch (error) {
    console.error('Reset voice profile error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
