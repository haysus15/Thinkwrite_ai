// src/app/api/mirror-mode/document/[id]/route.ts
// DELETE endpoint for hiding a document (soft delete)

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: documentId } = await params;
    const supabase = await createSupabaseServerClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify document belongs to user before deleting (also fetch storage_path)
    const { data: document, error: fetchError } = await supabase
      .from('mirror_documents')
      .select('id, user_id, storage_path')
      .eq('id', documentId)
      .single();

    if (fetchError || !document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    if (document.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Soft delete: hide from archive, keep data for voice continuity
    const { error: deleteError } = await supabase
      .from('mirror_documents')
      .update({
        deleted_at: new Date().toISOString(),
        visibility_status: 'hidden',
      })
      .eq('id', documentId);

    if (deleteError) {
      console.error('Delete error:', deleteError);
      return NextResponse.json(
        { error: 'Failed to hide document', details: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      message: 'Document hidden successfully'
    });

  } catch (error) {
    console.error('Delete document error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Soft delete keeps derived metrics intact; no recalculation needed.
