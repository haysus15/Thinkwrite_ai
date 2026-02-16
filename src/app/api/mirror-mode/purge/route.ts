// src/app/api/mirror-mode/purge/route.ts
// POST endpoint for legal/privacy purge (standard or strict)

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type PurgeMode = 'standard' | 'strict';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const purgeMode = (body?.purge_mode as PurgeMode) || 'standard';
    const confirmation = body?.confirmation;

    if (confirmation !== 'PURGE') {
      return NextResponse.json(
        { error: 'Confirmation required. Type PURGE to confirm.' },
        { status: 400 }
      );
    }

    if (purgeMode !== 'standard' && purgeMode !== 'strict') {
      return NextResponse.json(
        { error: 'Invalid purge mode. Use "standard" or "strict".' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // Fetch all documents for user
    const { data: documents, error: docsError } = await supabase
      .from('mirror_documents')
      .select('id, storage_path')
      .eq('user_id', user.id);

    if (docsError) {
      return NextResponse.json(
        { error: 'Failed to fetch documents', details: docsError.message },
        { status: 500 }
      );
    }

    const documentIds = documents?.map((d) => d.id) || [];
    const storagePaths = documents?.map((d) => d.storage_path).filter(Boolean) || [];

    // Delete storage files (raw documents)
    if (storagePaths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from('user-documents')
        .remove(storagePaths);

      if (storageError) {
        console.error('Storage purge error:', storageError);
      }
    }

    // Delete extracted text content
    if (documentIds.length > 0) {
      const { error: contentDeleteError } = await supabase
        .from('mirror_document_content')
        .delete()
        .in('document_id', documentIds);

      if (contentDeleteError) {
        console.error('Content purge error:', contentDeleteError);
      }
    }

    // Mark documents as purged (soft state)
    const { error: docUpdateError } = await supabase
      .from('mirror_documents')
      .update({
        deleted_at: now,
        visibility_status: 'purged',
      })
      .eq('user_id', user.id);

    if (docUpdateError) {
      return NextResponse.json(
        { error: 'Failed to mark documents as purged (schema upgrade required?)' },
        { status: 500 }
      );
    }

    if (purgeMode === 'strict') {
      // Strict purge: destroy derived metrics traceable to docs by resetting profile
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
          extractedAt: now,
          version: '1.0.0',
        },
      };

      await supabase
        .from('voice_profiles')
        .update({
          aggregate_fingerprint: emptyFingerprint,
          confidence_level: 0,
          document_count: 0,
          total_word_count: 0,
          last_trained_at: null,
          evolution_history: [],
          updated_at: now,
        })
        .eq('user_id', user.id);

      // Archive current epoch and start a new one (best effort)
      const { data: currentEpochRow } = await supabase
        .from('voice_profile_epochs')
        .select('id, epoch_number')
        .eq('user_id', user.id)
        .is('ended_at', null)
        .order('epoch_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      const currentEpochNumber = currentEpochRow?.epoch_number || 1;

      if (currentEpochRow) {
        await supabase
          .from('voice_profile_epochs')
          .update({
            ended_at: now,
            archived_profile_data: { archivedAt: now, reason: 'strict_purge' },
            reason: 'user_requested_purge',
          })
          .eq('id', currentEpochRow.id);
      } else {
        await supabase
          .from('voice_profile_epochs')
          .insert({
            user_id: user.id,
            epoch_number: currentEpochNumber,
            started_at: now,
            ended_at: now,
            archived_profile_data: { archivedAt: now, reason: 'strict_purge' },
            reason: 'user_requested_purge',
          });
      }

      await supabase
        .from('voice_profile_epochs')
        .insert({
          user_id: user.id,
          epoch_number: currentEpochNumber + 1,
          started_at: now,
        });
    }

    return NextResponse.json({ success: true, purged: true, mode: purgeMode });
  } catch (error) {
    console.error('Purge error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
