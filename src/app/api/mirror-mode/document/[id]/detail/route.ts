// src/app/api/mirror-mode/document/[id]/detail/route.ts
// GET /api/mirror-mode/document/[id]/detail
// Returns full document detail including fingerprint and text preview

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: documentId } = await params;
    const supabase = await createSupabaseServerClient();

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401, headers: noStoreHeaders }
      );
    }

    // Fetch document with fingerprint
    const { data: document, error: docError } = await supabase
      .from('mirror_documents')
      .select('*')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single();

    if (docError || !document) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404, headers: noStoreHeaders }
      );
    }

    // Fetch extracted text
    const { data: content } = await supabase
      .from('mirror_document_content')
      .select('extracted_text')
      .eq('document_id', documentId)
      .single();

    // Fetch evolution entry for this document from voice_profiles
    const { data: profile } = await supabase
      .from('voice_profiles')
      .select('evolution_history')
      .eq('user_id', user.id)
      .single();

    const evolutionEntry = (profile?.evolution_history || [])
      .find((e: any) => e.documentId === documentId);

    // Text preview (first 500 words)
    const fullText = content?.extracted_text || '';
    const words = fullText.split(/\s+/).filter(Boolean);
    const textPreview = words.slice(0, 500).join(' ');
    const hasMore = words.length > 500;

    return NextResponse.json(
      {
        success: true,
        document: {
          id: document.id,
          fileName: document.file_name,
          writingType: document.writing_type,
          wordCount: document.word_count,
          fileSize: document.file_size,
          mimeType: document.mime_type,
          status: document.status,
          learnedAt: document.learned_at,
          createdAt: document.created_at,
        },
        fingerprint: document.document_fingerprint,
        impact: evolutionEntry || null,
        textPreview: {
          text: textPreview,
          totalWords: words.length,
          hasMore,
        },
      },
      { status: 200, headers: noStoreHeaders }
    );
  } catch (error: any) {
    console.error('Document detail error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal server error' },
      { status: 500, headers: noStoreHeaders }
    );
  }
}
