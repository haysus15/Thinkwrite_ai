// src/app/api/mirror-mode/reset/route.ts
// POST endpoint for completely resetting user's voice profile

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

    // 1. Get all document IDs and storage paths for this user
    const { data: documents } = await supabase
      .from('mirror_documents')
      .select('id, storage_path')
      .eq('user_id', user.id);

    const documentIds = documents?.map(d => d.id) || [];
    const storagePaths = documents?.map(d => d.storage_path).filter(Boolean) || [];

    // 2. Delete all files from storage
    if (storagePaths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from('user-documents')
        .remove(storagePaths);

      if (storageError) {
        console.error('Storage delete error:', storageError);
        // Continue with database deletion even if storage fails
      }
    }

    // 3. Delete all document content
    if (documentIds.length > 0) {
      const { error: contentDeleteError } = await supabase
        .from('mirror_document_content')
        .delete()
        .in('document_id', documentIds);

      if (contentDeleteError) {
        console.error('Content delete error:', contentDeleteError);
      }
    }

    // 4. Delete all documents
    const { error: docsDeleteError } = await supabase
      .from('mirror_documents')
      .delete()
      .eq('user_id', user.id);

    if (docsDeleteError) {
      console.error('Documents delete error:', docsDeleteError);
      return NextResponse.json(
        { error: 'Failed to delete documents' },
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
      deletedDocuments: documentIds.length
    });

  } catch (error) {
    console.error('Reset voice profile error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
