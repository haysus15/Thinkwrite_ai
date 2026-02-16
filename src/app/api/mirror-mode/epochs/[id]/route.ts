// src/app/api/mirror-mode/epochs/[id]/route.ts
// Fetch epoch detail snapshot

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const { data: epoch, error } = await supabase
      .from('voice_profile_epochs')
      .select('id, epoch_number, started_at, ended_at, reason, archived_profile_data')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error || !epoch) {
      return NextResponse.json({ error: 'Epoch not found' }, { status: 404 });
    }

    const epochNumber = epoch?.epoch_number || null;
    let documentSamples: any[] = [];
    if (epochNumber) {
      const { data: docs } = await supabase
        .from('mirror_documents')
        .select('id, file_name, writing_type, word_count, uploaded_at')
        .eq('user_id', user.id)
        .eq('epoch_number', epochNumber)
        .order('uploaded_at', { ascending: false })
        .limit(5);
      documentSamples = docs || [];
    }

    const profile = epoch?.archived_profile_data?.profile || null;
    const topPatterns = profile?.aggregate_fingerprint?.vocabulary?.topWords || [];

    return NextResponse.json({
      success: true,
      epoch,
      snapshot: epoch?.archived_profile_data || null,
      documents: documentSamples,
      top_patterns: topPatterns,
    });
  } catch (error) {
    console.error('Epoch detail GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
