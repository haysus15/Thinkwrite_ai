// src/app/api/voice-profile/gatekeeper/route.ts
// Gatekeeper endpoint: serves chamber + general + overall voice data to studios

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/getAuthUser';
import { getGatekeeperContext } from '@/services/voice-profile/gatekeeper';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

type Studio = 'career' | 'academic' | 'creative';
type Chamber = 'career' | 'academic' | 'creative' | 'general' | 'overall';

const STUDIO_TO_CHAMBER: Record<Studio, Chamber> = {
  career: 'career',
  academic: 'academic',
  creative: 'creative',
};

function isStudio(value: string | null | undefined): value is Studio {
  return value === 'career' || value === 'academic' || value === 'creative';
}

export async function POST(req: NextRequest) {
  try {
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const requestingStudio = body?.requesting_studio as string | undefined;
    const context = body?.context as string | undefined;

    if (!isStudio(requestingStudio)) {
      return NextResponse.json(
        { error: 'Invalid requesting_studio. Use career, academic, or creative.' },
        { status: 400 }
      );
    }

    const requestedChambers = Array.isArray(body?.requested_chambers)
      ? (body.requested_chambers as Chamber[])
      : [];
    const gatekeeper = await getGatekeeperContext(userId, requestingStudio, requestedChambers);
    if (!gatekeeper) {
      return NextResponse.json(
        { error: 'Failed to fetch chamber profiles' },
        { status: 500 }
      );
    }

    const { primaryChamber, primary, general, overall, sufficientData, counts, thresholds, warnings } = gatekeeper;
    const nonPrimaryRequests = requestedChambers.filter(
      (ch) => ch !== primaryChamber && ch !== 'general' && ch !== 'overall'
    );
    let blendDenied: string[] = [];
    if (nonPrimaryRequests.length > 0) {
      const supabase = await createSupabaseServerClient();
      const { data: consents } = await supabase
        .from('mirror_mode_blend_consent')
        .select('from_chamber, to_chamber, revoked_at, expires_at')
        .eq('user_id', userId)
        .eq('to_chamber', primaryChamber)
        .in('from_chamber', nonPrimaryRequests)
        .is('revoked_at', null);
      const now = new Date().toISOString();
      const allowedSet = new Set(
        (consents || [])
          .filter(
            (c: { expires_at: string | null; from_chamber: string }) =>
              !c.expires_at || c.expires_at > now
          )
          .map((c: { from_chamber: string }) => c.from_chamber)
      );
      blendDenied = nonPrimaryRequests.filter((ch) => !allowedSet.has(ch));
    }
    const finalWarnings = [...(warnings || [])];
    if (blendDenied.length > 0) {
      finalWarnings.push(
        `Blending consent required for: ${blendDenied.join(', ')} → ${primaryChamber}.`
      );
    }

    return NextResponse.json({
      voice_profile: {
        primary_chamber: primaryChamber,
        primary,
        general,
        overall,
        requested_chambers: requestedChambers,
      },
      confidence: {
        primary: primary?.confidence_level ?? 0,
        general: general?.confidence_level ?? 0,
        overall: overall?.confidence_level ?? 0,
      },
      sufficient_data: sufficientData,
      counts,
      thresholds,
      warnings: finalWarnings,
      blend: {
        denied: blendDenied,
        required: blendDenied.length > 0,
      },
      context: context || null,
    });
  } catch (error) {
    console.error('Gatekeeper error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
