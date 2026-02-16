// src/app/api/mirror-mode/lineage/update/route.ts
// Append lineage versions and editorial decisions

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/getAuthUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { lineage_id, document_id, version_type, content_snapshot, changes_made } = body || {};

    if ((!lineage_id && !document_id) || !version_type) {
      return NextResponse.json(
        { error: 'lineage_id or document_id and version_type are required' },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    // Fetch existing lineage
    let lineageQuery = supabase
      .from('document_lineage')
      .select('*')
      .eq('user_id', userId);

    if (lineage_id) {
      lineageQuery = lineageQuery.eq('id', lineage_id);
    } else if (document_id) {
      lineageQuery = lineageQuery.or(`original_document_id.eq.${document_id},current_version_id.eq.${document_id}`);
    }

    const { data: lineage, error: fetchError } = await lineageQuery
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (fetchError || !lineage) {
      return NextResponse.json(
        { error: 'Lineage not found' },
        { status: 404 }
      );
    }

    const nextHistory = Array.isArray(lineage.version_history)
      ? [...lineage.version_history]
      : [];

    nextHistory.push({
      version_type,
      content_snapshot: content_snapshot || null,
      changes_made: changes_made || null,
      created_at: new Date().toISOString(),
    });

    const nextEditorial = lineage.editorial_decisions || {};

    // If this update represents a user decision, capture it
    if (version_type === 'user_accepted' || version_type === 'user_rejected' || version_type === 'user_modified') {
      const decisionList = nextEditorial[version_type] || [];
      nextEditorial[version_type] = [...decisionList, { changes_made, at: new Date().toISOString() }];
    }

    const { error: updateError } = await supabase
      .from('document_lineage')
      .update({
        version_history: nextHistory,
        editorial_decisions: nextEditorial,
        updated_at: new Date().toISOString(),
      })
      .eq('id', lineage_id);

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update lineage', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ version_recorded: true });
  } catch (error: any) {
    console.error('Lineage update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
