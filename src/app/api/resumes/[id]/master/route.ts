// Fixed Set Master Resume API with Async Params
// src/app/api/resumes/[id]/master/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, createSupabaseAdmin } from '@/lib/auth/getAuthUser';
import { Errors } from '@/lib/api/errors';

export async function PUT(
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

    // First, remove master status from all user's resumes
    const { error: clearError } = await supabase
      .from('user_documents')
      .update({ is_master_resume: false })
      .eq('user_id', userId)
      .eq('is_active', true);

    if (clearError) {
      console.error('Error clearing master resume status:', clearError);
      return NextResponse.json({ error: 'Failed to update master resume' }, { status: 500 });
    }

    // Set the new master resume
    const { data: updatedResume, error: updateError } = await supabase
      .from('user_documents')
      .update({ is_master_resume: true })
      .eq('id', resumeId)
      .eq('user_id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Error setting master resume:', updateError);
      return NextResponse.json({ error: 'Failed to set master resume' }, { status: 500 });
    }

    if (!updatedResume) {
      return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
    }

    console.log('✅ Master resume updated:', updatedResume.file_name);

    return NextResponse.json({
      success: true,
      message: `${updatedResume.file_name} is now your Master Resume`,
      masterResumeId: resumeId
    });

  } catch (error) {
    console.error('Error in PUT /api/resumes/[id]/master:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}