// src/app/api/mirror-mode/consent/blending/route.ts
// Cross-chamber blending consent scaffolding (future feature)

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

type Chamber = 'career' | 'academic' | 'creative' | 'general';

type Scope = 'one_time' | 'session' | 'persistent';

function isChamber(value: string | null | undefined): value is Chamber {
  return value === 'career' || value === 'academic' || value === 'creative' || value === 'general';
}

function isScope(value: string | null | undefined): value is Scope {
  return value === 'one_time' || value === 'session' || value === 'persistent';
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    if (!isChamber(from) || !isChamber(to)) {
      return NextResponse.json({ error: 'from and to chambers are required' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { data } = await supabase
      .from('mirror_mode_blend_consent')
      .select('id, scope, granted_at, expires_at, revoked_at')
      .eq('user_id', user.id)
      .eq('from_chamber', from)
      .eq('to_chamber', to)
      .is('revoked_at', null)
      .order('granted_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const allowed = Boolean(data?.id) && (!data?.expires_at || data.expires_at > now);

    return NextResponse.json({
      allowed,
      consent: data || null,
    });
  } catch (error) {
    console.error('Blend consent GET error:', error);
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
    const { from_chamber, to_chamber, scope, expires_in_days } = body || {};

    if (!isChamber(from_chamber) || !isChamber(to_chamber)) {
      return NextResponse.json({ error: 'from_chamber and to_chamber are required' }, { status: 400 });
    }

    if (scope && !isScope(scope)) {
      return NextResponse.json({ error: 'Invalid scope' }, { status: 400 });
    }

    const now = new Date();
    const expiresAt = typeof expires_in_days === 'number'
      ? new Date(now.getTime() + expires_in_days * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const { data: consent, error } = await supabase
      .from('mirror_mode_blend_consent')
      .insert({
        user_id: user.id,
        from_chamber,
        to_chamber,
        scope: scope || 'one_time',
        granted_at: now.toISOString(),
        expires_at: expiresAt,
        updated_at: now.toISOString(),
      })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to record consent' }, { status: 500 });
    }

    return NextResponse.json({ allowed: true, consent });
  } catch (error) {
    console.error('Blend consent POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { from_chamber, to_chamber } = body || {};

    if (!isChamber(from_chamber) || !isChamber(to_chamber)) {
      return NextResponse.json({ error: 'from_chamber and to_chamber are required' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { error } = await supabase
      .from('mirror_mode_blend_consent')
      .update({ revoked_at: now, updated_at: now })
      .eq('user_id', user.id)
      .eq('from_chamber', from_chamber)
      .eq('to_chamber', to_chamber)
      .is('revoked_at', null);

    if (error) {
      return NextResponse.json({ error: 'Failed to revoke consent' }, { status: 500 });
    }

    return NextResponse.json({ revoked: true });
  } catch (error) {
    console.error('Blend consent DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
