// src/app/api/mirror-mode/purge/route.ts
// POST endpoint for legal/privacy purge (standard or strict)

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
type PurgeMode = 'standard' | 'strict';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const purgeMode = (body?.purge_mode as PurgeMode) || 'standard';
    const confirmation = body?.confirmation;

    if (confirmation !== 'PURGE') {
      return NextResponse.json(
        { error: 'Confirmation required. Type PURGE to confirm.' },
        { status: 400 }
      );
    }

    if (purgeMode !== 'standard' && purgeMode !== 'strict') {
      return NextResponse.json(
        { error: 'Invalid purge mode. Use "standard" or "strict".' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // Fetch document storage paths once (used for storage deletion in both modes)
    const { data: documents, error: docsError } = await supabase
      .from('mirror_documents')
      .select('id, storage_path')
      .eq('user_id', user.id);

    if (docsError) {
      return NextResponse.json(
        { error: 'Failed to fetch documents', details: docsError.message },
        { status: 500 }
      );
    }

    const documentIds = documents?.map((d) => d.id) || [];
    const storagePaths = documents?.map((d) => d.storage_path).filter(Boolean) || [];

    if (purgeMode === 'strict') {
      // Strict purge is atomic at DB level.
      const { error: purgeError } = await supabase.rpc('strict_purge_user_data', {
        p_user_id: user.id,
      });

      if (purgeError) {
        console.error('Strict purge RPC failed:', purgeError);
        return NextResponse.json(
          {
            success: false,
            error: 'Purge could not complete. No data was deleted. Try again or contact support.',
            detail: purgeError.message,
          },
          { status: 500 }
        );
      }

      // Storage cleanup is best-effort and does not affect DB transaction outcome.
      if (storagePaths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from('user-documents')
          .remove(storagePaths);
        if (storageError) {
          console.error('Strict purge storage cleanup error:', storageError);
        }
      }

      return NextResponse.json({ success: true, purged: true, mode: purgeMode });
    }

    // Standard purge path (soft state + content cleanup)
    if (storagePaths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from('user-documents')
        .remove(storagePaths);
      if (storageError) {
        console.error('Storage purge error:', storageError);
      }
    }

    if (documentIds.length > 0) {
      const { error: contentDeleteError } = await supabase
        .from('mirror_document_content')
        .delete()
        .in('document_id', documentIds);
      if (contentDeleteError) {
        console.error('Content purge error:', contentDeleteError);
      }
    }

    const { error: docUpdateError } = await supabase
      .from('mirror_documents')
      .update({
        deleted_at: now,
        visibility_status: 'purged',
      })
      .eq('user_id', user.id);

    if (docUpdateError) {
      return NextResponse.json(
        { error: 'Failed to mark documents as purged (schema upgrade required?)' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, purged: true, mode: purgeMode });
  } catch (error) {
    console.error('Purge error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
