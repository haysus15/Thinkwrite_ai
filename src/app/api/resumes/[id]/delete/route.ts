// Fixed Delete Resume API with Async Params
// src/app/api/resumes/[id]/delete/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, createSupabaseAdmin } from '@/lib/auth/getAuthUser';
import { Errors } from '@/lib/api/errors';

export async function DELETE(
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

    // Check if this is the master resume
    const { data: resumeToDelete, error: fetchError } = await supabase
      .from('user_documents')
      .select('file_name, is_master_resume')
      .eq('id', resumeId)
      .eq('user_id', userId)
      .single();

    if (fetchError) {
      console.error('Error fetching resume to delete:', fetchError);
      return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
    }

    if (resumeToDelete.is_master_resume) {
      // Check if user has other resumes
      const { data: otherResumes } = await supabase
        .from('user_documents')
        .select('id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .neq('id', resumeId);

      if (otherResumes && otherResumes.length > 0) {
        // Set another resume as master before deleting
        const { error: newMasterError } = await supabase
          .from('user_documents')
          .update({ is_master_resume: true })
          .eq('id', otherResumes[0].id);

        if (newMasterError) {
          console.error('Error setting new master:', newMasterError);
          return NextResponse.json({ 
            error: 'Cannot delete master resume: failed to set new master' 
          }, { status: 500 });
        }
      }
    }

    // Soft delete the resume (set is_active = false)
    const { error: deleteError } = await supabase
      .from('user_documents')
      .update({ 
        is_active: false,
        is_master_resume: false 
      })
      .eq('id', resumeId)
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Error deleting resume:', deleteError);
      return NextResponse.json({ error: 'Failed to delete resume' }, { status: 500 });
    }

    console.log('✅ Resume deleted:', resumeToDelete.file_name);

    return NextResponse.json({
      success: true,
      message: `${resumeToDelete.file_name} has been deleted`,
      wasmaster: resumeToDelete.is_master_resume
    });

  } catch (error) {
    console.error('Error in DELETE /api/resumes/[id]/delete:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}