// src/app/api/resumes/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, createSupabaseAdmin } from '@/lib/auth/getAuthUser';
import { Errors } from '@/lib/api/errors';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return Errors.unauthorized();
    }

    const supabase = createSupabaseAdmin();
    const { id: resumeId } = await params;

    // Only fetch user's own resume
    const { data: resume, error } = await supabase
      .from('user_documents')
      .select('*')
      .eq('id', resumeId)
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('❌ Resume fetch error:', error);
      return NextResponse.json(
        { success: false, error: 'Resume not found' },
        { status: 404 }
      );
    }

    if (!resume) {
      return NextResponse.json(
        { success: false, error: 'Resume not found' },
        { status: 404 }
      );
    }

    console.log(`✅ Resume found: ${resume.file_name}`);

    // Return resume data
    return NextResponse.json({
      success: true,
      resume: {
        id: resume.id,
        fileName: resume.file_name,
        fullText: resume.full_text,
        extractedText: resume.extracted_text,
        automatedAnalysis: resume.automated_analysis,
        lexAnalyses: resume.lex_analyses,
        analysisStatus: resume.analysis_status,
        createdAt: resume.created_at,
        updatedAt: resume.updated_at,
      },
    });

  } catch (error: any) {
    console.error('❌ Resume API error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}