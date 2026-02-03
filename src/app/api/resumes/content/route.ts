// Get resume content by ID
// src/app/api/resumes/content/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, createSupabaseAdmin } from '@/lib/auth/getAuthUser';
import { Errors } from '@/lib/api/errors';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return Errors.unauthorized();
    }

    const supabase = createSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const resumeId = searchParams.get('resumeId');

    if (!resumeId) {
      return Errors.missingField('resumeId');
    }

    const { data: resume, error } = await supabase
      .from('user_documents')
      .select('id, file_name, extracted_text')
      .eq('id', resumeId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (error || !resume) {
      console.error('❌ Resume not found:', error);
      return NextResponse.json({ 
        success: false, 
        error: 'Resume not found' 
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      resumeId: resume.id,
      fileName: resume.file_name,
      content: resume.extracted_text || '',
      extractedText: resume.extracted_text || '',
    });

  } catch (error) {
    console.error('❌ Error fetching resume content:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Failed to fetch resume content',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}