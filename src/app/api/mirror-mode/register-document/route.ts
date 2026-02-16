// src/app/api/mirror-mode/register-document/route.ts
// Register a document uploaded through any studio (creates lineage)

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/getAuthUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';

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

    const body = await req.json();
    const {
      document_id,
      source_studio,
      file_path,
      file_type,
      document_type,
    } = body || {};

    if (!document_id || !isStudio(source_studio)) {
      return NextResponse.json(
        { error: 'document_id and valid source_studio are required' },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    // Create lineage record
    const { data: lineage, error: lineageError } = await supabase
      .from('document_lineage')
      .insert({
        user_id: userId,
        original_document_id: document_id,
        studio_origin: source_studio,
        current_version_id: document_id,
        version_history: [
          {
            version_type: 'original',
            document_id,
            source_studio,
            file_path: file_path || null,
            file_type: file_type || null,
            document_type: document_type || null,
            created_at: new Date().toISOString(),
          },
        ],
      })
      .select('id')
      .single();

    if (lineageError || !lineage) {
      return NextResponse.json(
        { error: 'Failed to create lineage record', details: lineageError?.message },
        { status: 500 }
      );
    }

    // Return minimal response for now
    return NextResponse.json({
      lineage_id: lineage.id,
      mirror_mode_document_id: document_id,
      chamber: source_studio, // chamber aligns to studio for now
    });
  } catch (error: any) {
    console.error('Register document error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
