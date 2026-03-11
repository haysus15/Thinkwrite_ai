// src/app/api/mirror-mode/capture/route.ts
// Capture user writing from studios (async, fire-and-forget)

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/getAuthUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ingestStudioWriting } from '@/lib/mirror-mode/studioIngestion';
import { SOURCE_AUTHORITY } from '@/lib/mirror-mode/sourceAuthority';

export const runtime = 'nodejs';

type Studio = 'career' | 'academic' | 'creative';

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
    const {
      user_text,
      source_studio,
      session_id,
      context,
      archive_document,
      file_name,
      mime_type,
      file_size,
      writing_type,
    } = body || {};

    if (!user_text || !isStudio(source_studio)) {
      return NextResponse.json(
        { error: 'user_text and valid source_studio are required' },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    const result = await ingestStudioWriting({
      supabase,
      userId,
      sourceStudio: source_studio,
      sourceAuthority: SOURCE_AUTHORITY.USER_TYPED,
      text: user_text,
      sessionId: session_id || null,
      context: context || null,
      fileName: file_name || null,
      mimeType: mime_type || null,
      fileSize: typeof file_size === 'number' ? file_size : null,
      writingType: writing_type || undefined,
      // capture route is learning-first; archive only when explicitly requested
      registerInArchive: archive_document === true,
    });

    return NextResponse.json({
      captured: result.captured,
      archived: result.archived,
      needs_consent: result.needsConsent,
      mirror_document_id: result.mirrorDocumentId,
      word_count: result.wordCount,
    });
  } catch (error: any) {
    console.error('Capture error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
