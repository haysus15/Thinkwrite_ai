// src/app/api/mirror-mode/consent/history/route.ts
// Fetch consent history for Mirror Mode

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: history, error } = await supabase
      .from('mirror_mode_consent_history')
      .select('id, studio, consented_at, source')
      .eq('user_id', user.id)
      .order('consented_at', { ascending: false })
      .limit(200);

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch consent history' }, { status: 500 });
    }

    return NextResponse.json({ success: true, history: history || [] });
  } catch (error) {
    console.error('Consent history GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
