// src/app/api/mirror-mode/consent/route.ts
// Studio-level consent moments for Mirror Mode capture

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

type Studio = 'career' | 'academic' | 'creative';

function isStudio(value: string | null | undefined): value is Studio {
  return value === 'career' || value === 'academic' || value === 'creative';
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const studio = searchParams.get('studio');

    if (!isStudio(studio)) {
      return NextResponse.json({ error: 'Valid studio is required' }, { status: 400 });
    }

    const { data: consent } = await supabase
      .from('mirror_mode_consent')
      .select('id, consented_at')
      .eq('user_id', user.id)
      .eq('studio', studio)
      .maybeSingle();

    return NextResponse.json({
      consented: Boolean(consent?.id),
      consented_at: consent?.consented_at || null,
    });
  } catch (error) {
    console.error('Consent GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { studio } = body || {};

    if (!isStudio(studio)) {
      return NextResponse.json({ error: 'Valid studio is required' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { error: upsertError } = await supabase
      .from('mirror_mode_consent')
      .upsert({
        user_id: user.id,
        studio,
        consented_at: now,
        updated_at: now,
      }, { onConflict: 'user_id,studio' });

    if (upsertError) {
      return NextResponse.json({ error: 'Failed to record consent' }, { status: 500 });
    }

    // Append history (best effort)
    try {
      await supabase
        .from('mirror_mode_consent_history')
        .insert({
          user_id: user.id,
          studio,
          consented_at: now,
          source: 'studio_modal',
        });
    } catch {
      // Silent fail
    }

    return NextResponse.json({ consented: true, consented_at: now });
  } catch (error) {
    console.error('Consent POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
