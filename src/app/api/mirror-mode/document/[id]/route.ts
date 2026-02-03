// src/app/api/mirror-mode/document/[id]/route.ts
// DELETE endpoint for removing a document from voice training

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

    // Delete file from storage (if storage_path exists)
    if (document.storage_path) {
      const { error: storageError } = await supabase.storage
        .from('user-documents')
        .remove([document.storage_path]);

      if (storageError) {
        console.error('Storage delete error:', storageError);
        // Continue with database deletion even if storage fails
      }
    }

    // Delete document content first (if exists)
    await supabase
      .from('mirror_document_content')
      .delete()
      .eq('document_id', documentId);

    // Delete the document
    const { error: deleteError } = await supabase
      .from('mirror_documents')
      .delete()
      .eq('id', documentId);

    if (deleteError) {
      console.error('Delete error:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete document' },
        { status: 500 }
      );
    }

    // Recalculate voice profile based on remaining documents
    await recalculateVoiceProfile(supabase, user.id);

    return NextResponse.json({ 
      success: true,
      message: 'Document deleted successfully'
    });

  } catch (error) {
    console.error('Delete document error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function recalculateVoiceProfile(supabase: any, userId: string) {
  // Get remaining documents
  const { data: documents } = await supabase
    .from('mirror_documents')
    .select('*')
    .eq('user_id', userId)
    .eq('analyzed', true);

  if (!documents || documents.length === 0) {
    // No documents left - reset voice profile to empty state
    await supabase
      .from('voice_profiles')
      .update({
        aggregate_fingerprint: null,
        confidence_level: 0,
        document_count: 0,
        total_word_count: 0,
        last_trained_at: null,
        evolution_history: [],
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);
    return;
  }

  // If documents remain, just update the timestamp to trigger a refresh
  await supabase
    .from('voice_profiles')
    .update({
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);
}
