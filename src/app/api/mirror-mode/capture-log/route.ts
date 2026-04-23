import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/getAuthUser';
import {
  SOURCE_AUTHORITY,
  type SourceAuthority,
} from '@/lib/mirror-core/sourceAuthority';
import {
  getRetentionLabel,
  getSourceLabel,
} from '@/lib/mirror-core/ingestionPolicy';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { mapWritingTypeToChamber, type Chamber } from '@/lib/mirror-core/writingTypes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SOURCE_VALUES = Object.values(SOURCE_AUTHORITY);
const CHAMBERS: Chamber[] = ['career', 'academic', 'creative', 'general'];

type CaptureType = 'document' | 'extension';

type CaptureEvent = {
  id: string;
  captureType: CaptureType;
  sourceAuthority: SourceAuthority;
  excludedFromProfile: boolean;
  chamber: Chamber;
  wordCount: number;
  capturedAt: string;
  hostname?: string;
  sourceLabel: string;
  retentionLabel: string;
};

type MirrorDocumentRow = {
  id: string;
  source_authority: string | null;
  excluded_from_profile: boolean | null;
  writing_type: string | null;
  word_count: number | null;
  created_at: string | null;
};

type ExtensionActivityRow = {
  id: string;
  source_authority: string | null;
  chamber: string | null;
  word_count: number | null;
  captured_at: string | null;
  hostname: string | null;
};

function parseDays(value: string | null): number {
  const parsed = Number.parseInt(value || '7', 10);
  if (!Number.isFinite(parsed)) return 7;
  return Math.min(Math.max(parsed, 1), 90);
}

function isSourceAuthority(value: string | null | undefined): value is SourceAuthority {
  return !!value && SOURCE_VALUES.includes(value as SourceAuthority);
}

function isChamber(value: string | null | undefined): value is Chamber {
  return !!value && CHAMBERS.includes(value as Chamber);
}

function normalizeSourceAuthority(value: string | null | undefined): SourceAuthority {
  if (isSourceAuthority(value)) return value;
  return SOURCE_AUTHORITY.UNKNOWN;
}

export async function GET(req: NextRequest) {
  const auth = await getAuthUser();
  if (auth.error || !auth.userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const days = parseDays(req.nextUrl.searchParams.get('days'));
    const sourceParam = req.nextUrl.searchParams.get('source');
    const chamberParam = req.nextUrl.searchParams.get('chamber');

    if (sourceParam && !isSourceAuthority(sourceParam)) {
      return NextResponse.json(
        { success: false, error: 'Invalid source filter.' },
        { status: 400 }
      );
    }
    if (chamberParam && !isChamber(chamberParam)) {
      return NextResponse.json(
        { success: false, error: 'Invalid chamber filter.' },
        { status: 400 }
      );
    }

    const sourceFilter = isSourceAuthority(sourceParam) ? sourceParam : null;
    const chamberFilter = isChamber(chamberParam) ? chamberParam : null;

    const windowTo = new Date();
    const windowFrom = new Date(windowTo.getTime() - days * 24 * 60 * 60 * 1000);
    const windowFromIso = windowFrom.toISOString();
    const windowToIso = windowTo.toISOString();

    const supabase = await createSupabaseServerClient();

    let documentQuery = supabase
      .from('mirror_documents')
      .select(
        'id, source_authority, excluded_from_profile, writing_type, word_count, created_at'
      )
      .eq('user_id', auth.userId)
      .gte('created_at', windowFromIso)
      .order('created_at', { ascending: false })
      .limit(200);

    if (sourceFilter) {
      documentQuery = documentQuery.eq('source_authority', sourceFilter);
    }

    const { data: documentRows, error: documentsError } = await documentQuery;
    if (documentsError) {
      return NextResponse.json(
        { success: false, error: documentsError.message },
        { status: 500 }
      );
    }

    let extensionQuery = supabase
      .from('mirror_extension_activity')
      .select('id, source_authority, chamber, word_count, captured_at, hostname')
      .eq('user_id', auth.userId)
      .gte('captured_at', windowFromIso)
      .order('captured_at', { ascending: false })
      .limit(200);

    if (sourceFilter) {
      extensionQuery = extensionQuery.eq('source_authority', sourceFilter);
    }
    if (chamberFilter) {
      extensionQuery = extensionQuery.eq('chamber', chamberFilter);
    }

    const { data: extensionRows, error: extensionError } = await extensionQuery;
    if (extensionError) {
      if (
        String(extensionError.message || '').includes('relation') ||
        String(extensionError.message || '').includes('does not exist')
      ) {
        // Backward compatibility: extension table may not exist in some environments yet.
      } else {
        return NextResponse.json(
          { success: false, error: extensionError.message },
          { status: 500 }
        );
      }
    }

    const documentCaptures: CaptureEvent[] = ((documentRows || []) as MirrorDocumentRow[])
      .map((row) => {
        const sourceAuthority = normalizeSourceAuthority(row.source_authority);
        const chamber = mapWritingTypeToChamber(row.writing_type);
        const excludedFromProfile = Boolean(row.excluded_from_profile);
        return {
          id: row.id,
          captureType: 'document' as const,
          sourceAuthority,
          excludedFromProfile,
          chamber,
          wordCount: Number(row.word_count || 0),
          capturedAt: row.created_at || windowToIso,
          sourceLabel: getSourceLabel(sourceAuthority),
          retentionLabel: getRetentionLabel(sourceAuthority, !excludedFromProfile),
        };
      })
      .filter((event) => (chamberFilter ? event.chamber === chamberFilter : true));

    const extensionCaptures: CaptureEvent[] = ((extensionRows || []) as ExtensionActivityRow[]).map(
      (row) => {
        const sourceAuthority = normalizeSourceAuthority(row.source_authority);
        const chamber = isChamber(row.chamber) ? row.chamber : 'general';
        const hostname = row.hostname || undefined;
        return {
          id: row.id,
          captureType: 'extension' as const,
          sourceAuthority,
          excludedFromProfile: false,
          chamber,
          wordCount: Number(row.word_count || 0),
          capturedAt: row.captured_at || windowToIso,
          hostname,
          sourceLabel: getSourceLabel(sourceAuthority, hostname),
          retentionLabel: getRetentionLabel(sourceAuthority, true),
        };
      }
    );

    const captures = [...documentCaptures, ...extensionCaptures].sort(
      (a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime()
    );

    const bySource: Record<SourceAuthority, number> = {
      [SOURCE_AUTHORITY.USER_TYPED]: 0,
      [SOURCE_AUTHORITY.USER_UPLOADED]: 0,
      [SOURCE_AUTHORITY.USER_QUICKSTART]: 0,
      [SOURCE_AUTHORITY.PLAYGROUND_CONVERSATION]: 0,
      [SOURCE_AUTHORITY.AI_GENERATED_ACCEPTED]: 0,
      [SOURCE_AUTHORITY.AI_GENERATED_REJECTED]: 0,
      [SOURCE_AUTHORITY.EXTENSION_CAPTURED]: 0,
      [SOURCE_AUTHORITY.UNKNOWN]: 0,
    };

    const byChamber: Record<Chamber, number> = {
      career: 0,
      academic: 0,
      creative: 0,
      general: 0,
    };

    let profileEligibleCount = 0;
    let excludedCount = 0;
    let wordCountTotal = 0;

    for (const capture of captures) {
      bySource[capture.sourceAuthority] += 1;
      byChamber[capture.chamber] += 1;
      wordCountTotal += capture.wordCount;

      if (capture.excludedFromProfile) {
        excludedCount += 1;
      } else {
        profileEligibleCount += 1;
      }
    }

    return NextResponse.json({
      success: true,
      window: {
        days,
        from: windowFromIso,
        to: windowToIso,
      },
      summary: {
        totalCaptures: captures.length,
        profileEligibleCount,
        excludedCount,
        bySource,
        byChamber,
        wordCountTotal,
      },
      captures,
    });
  } catch (error: any) {
    console.error('[Mirror capture-log]', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
