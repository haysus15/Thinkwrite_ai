// Document Memory API - Lex's Document Storage & Retrieval
// src/app/api/lex/documents/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, createSupabaseAdmin } from '@/lib/auth/getAuthUser';
import { Errors } from '@/lib/api/errors';

interface DocumentMemory {
  id: string;
  fileName: string;
  fileType: 'resume' | 'job_posting' | 'cover_letter' | 'unknown';
  analysis: any;
  lexNotes?: string;
  uploadedAt: string;
  lastReferenced: string;
}

// Get user's document library for Lex to reference
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return Errors.unauthorized();
    }

    const supabase = createSupabaseAdmin();

    // Get user's documents from database
    const { data: documents, error } = await supabase
      .from('user_documents')
      .select(`
        id,
        file_name,
        file_type,
        file_size,
        extracted_text,
        analysis_summary,
        key_points,
        skills,
        experience,
        education,
        ats_score,
        recommendations,
        gaps,
        strengths,
        lex_notes,
        last_referenced_at,
        reference_count,
        created_at
      `)
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
    }

    // Format for Lex's memory context
    const documentLibrary: DocumentMemory[] = documents.map(doc => ({
      id: doc.id,
      fileName: doc.file_name,
      fileType: doc.file_type,
      analysis: {
        summary: doc.analysis_summary,
        keyPoints: doc.key_points,
        skills: doc.skills,
        experience: doc.experience,
        education: doc.education,
        atsScore: doc.ats_score,
        recommendations: doc.recommendations,
        gaps: doc.gaps,
        strengths: doc.strengths
      },
      lexNotes: doc.lex_notes,
      uploadedAt: doc.created_at,
      lastReferenced: doc.last_referenced_at,
      extractedText: doc.extracted_text?.substring(0, 500) + '...' // Preview only
    }));

    return NextResponse.json({
      success: true,
      documents: documentLibrary,
      totalDocuments: documents.length
    });

  } catch (error) {
    console.error('Document memory error:', error);
    return NextResponse.json({ error: 'Failed to load document memory' }, { status: 500 });
  }
}

// Save document analysis to Lex's memory
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return Errors.unauthorized();
    }

    const supabase = createSupabaseAdmin();
    const body = await request.json();
    const {
      fileName,
      fileType,
      fileSize,
      extractedText,
      analysis,
      filePath
    } = body;

    if (!fileName || !extractedText) {
      return Errors.validationError('Missing required fields: fileName, extractedText');
    }

    // ENSURE USER EXISTS - Create if needed
    const { data: existingUser, error: userCheckError } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    if (!existingUser) {
      console.log('Creating user record for:', userId);
      const { error: userCreateError } = await supabase
        .from('users')
        .insert({
          id: userId,
          email: `user-${userId}@thinkwrite.ai`,
          name: 'ThinkWrite User'
        });

      if (userCreateError) {
        console.error('User creation error:', userCreateError);
        // Continue anyway - user might have been created by another request
      }
    }

    // Save document to database
    const { data: document, error } = await supabase
      .from('user_documents')
      .insert({
        user_id: userId,
        file_name: fileName,
        file_type: fileType || 'unknown',
        file_size: fileSize,
        file_path: filePath,
        extracted_text: extractedText,
        analysis_summary: analysis.summary,
        key_points: analysis.keyPoints,
        skills: analysis.skills,
        experience: analysis.experience,
        education: analysis.education,
        ats_score: analysis.atsScore,
        recommendations: analysis.recommendations,
        gaps: analysis.gaps,
        strengths: analysis.strengths,
        raw_analysis: analysis.rawAnalysis || {},
        reference_count: 1,
        last_referenced_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Document save error:', error);
      return NextResponse.json({ error: 'Failed to save document' }, { status: 500 });
    }

    // Update Lex's memory context
    await updateLexMemoryContext(userId, document.id, fileType);

    return NextResponse.json({
      success: true,
      documentId: document.id,
      message: 'Document saved to Lex\'s memory'
    });

  } catch (error) {
    console.error('Document save error:', error);
    return NextResponse.json({ error: 'Failed to save document' }, { status: 500 });
  }
}

// Update document reference (when Lex refers to it)
export async function PATCH(request: NextRequest) {
  try {
    // Authenticate user
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return Errors.unauthorized();
    }

    const supabase = createSupabaseAdmin();
    const body = await request.json();
    const { documentId, lexNotes } = body;

    if (!documentId) {
      return Errors.missingField('documentId');
    }

    // First get current reference count and verify ownership
    const { data: currentDoc } = await supabase
      .from('user_documents')
      .select('reference_count')
      .eq('id', documentId)
      .eq('user_id', userId)
      .single();

    const newCount = (currentDoc?.reference_count || 0) + 1;

    // Update reference count and notes - only user's own documents
    const { error } = await supabase
      .from('user_documents')
      .update({
        reference_count: newCount,
        last_referenced_at: new Date().toISOString(),
        lex_notes: lexNotes,
        updated_at: new Date().toISOString()
      })
      .eq('id', documentId)
      .eq('user_id', userId);

    if (error) {
      console.error('Document update error:', error);
      return NextResponse.json({ error: 'Failed to update document' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Document reference updated'
    });

  } catch (error) {
    console.error('Document update error:', error);
    return NextResponse.json({ error: 'Failed to update document reference' }, { status: 500 });
  }
}
// Helper function to update Lex's memory context
async function updateLexMemoryContext(userId: string, documentId: string, fileType: string) {
  try {
    const supabase = createSupabaseAdmin();
    // Get or create Lex memory context
    let { data: memory, error } = await supabase
      .from('lex_memory_context')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Memory context fetch error:', error);
      return;
    }

    if (!memory) {
      // Create new memory context
      const { error: insertError } = await supabase
        .from('lex_memory_context')
        .insert({
          user_id: userId,
          primary_resume_id: fileType === 'resume' ? documentId : null,
          recent_document_ids: [documentId],
          total_conversations: 0,
          updated_at: new Date().toISOString()
        });

      if (insertError) {
        console.error('Memory context creation error:', insertError);
      }
    } else {
      // Update existing memory context
      const recentDocs = memory.recent_document_ids || [];
      const updatedRecentDocs = [documentId, ...recentDocs.filter((id: string) => id !== documentId)].slice(0, 5);

      const updates: any = {
        recent_document_ids: updatedRecentDocs,
        updated_at: new Date().toISOString()
      };

      // Update primary resume if this is a resume
      if (fileType === 'resume') {
        updates.primary_resume_id = documentId;
      }

      const { error: updateError } = await supabase
        .from('lex_memory_context')
        .update(updates)
        .eq('user_id', userId);

      if (updateError) {
        console.error('Memory context update error:', updateError);
      }
    }
  } catch (error) {
    console.error('Memory context error:', error);
  }
}