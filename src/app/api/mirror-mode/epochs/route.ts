// src/app/api/mirror-mode/epochs/route.ts
// Fetch epoch history for Mirror Mode

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeSnapshot = searchParams.get('include_snapshot') === '1';

    const selectFields = includeSnapshot
      ? 'id, epoch_number, started_at, ended_at, reason, archived_profile_data'
      : 'id, epoch_number, started_at, ended_at, reason';

    const { data: epochs, error } = await supabase
      .from('voice_profile_epochs')
      .select(selectFields)
      .eq('user_id', user.id)
      .order('started_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch epochs' }, { status: 500 });
    }

    return NextResponse.json({ success: true, epochs: epochs || [] });
  } catch (error) {
    console.error('Epochs GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
