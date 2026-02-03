// Individual Tailored Resume API Route
// src/app/api/tailored-resume/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, createSupabaseAdmin } from '@/lib/auth/getAuthUser';
import { Errors } from '@/lib/api/errors';
import {
  transformTailoredResumeFromDB,
  type TailoredResumeDB,
  type ResumeChange
} from '@/types/tailored-resume';

// GET: Fetch a single tailored resume with all details
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
    const { id } = await params;

    const { data: tailoredResume, error } = await supabase
      .from('tailored_resumes')
      .select(`
        *,
        job_analyses(
          job_title,
          company_name,
          location,
          job_description,
          requirements,
          responsibilities,
          ats_keywords,
          hidden_insights
        ),
        user_documents(
          file_name,
          file_type,
          extracted_text
        )
      `)
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error || !tailoredResume) {
      console.error('Fetch error:', error);
      return NextResponse.json(
        { error: 'Tailored resume not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      tailoredResume: {
        ...transformTailoredResumeFromDB(tailoredResume as TailoredResumeDB),
        jobDetails: {
          title: tailoredResume.job_analyses?.job_title,
          company: tailoredResume.job_analyses?.company_name,
          location: tailoredResume.job_analyses?.location,
          description: tailoredResume.job_analyses?.job_description,
          requirements: tailoredResume.job_analyses?.requirements,
          responsibilities: tailoredResume.job_analyses?.responsibilities,
          atsKeywords: tailoredResume.job_analyses?.ats_keywords,
          hiddenInsights: tailoredResume.job_analyses?.hidden_insights
        },
        masterResume: {
          fileName: tailoredResume.user_documents?.file_name,
          fileType: tailoredResume.user_documents?.file_type
        }
      }
    });

  } catch (error) {
    console.error('GET tailored resume error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH: Update tailored resume (version name, finalize, etc.)
export async function PATCH(
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
    const { id } = await params;
    const body = await request.json();
    const { versionName, isFinalized } = body;

    const updates: any = {
      updated_at: new Date().toISOString()
    };

    if (versionName !== undefined) {
      updates.version_name = versionName;
    }

    if (isFinalized !== undefined) {
      updates.is_finalized = isFinalized;
      if (isFinalized) {
        updates.finalized_at = new Date().toISOString();
      }
    }

    const { data: updated, error } = await supabase
      .from('tailored_resumes')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Update error:', error);
      return NextResponse.json(
        { error: 'Failed to update tailored resume' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      tailoredResume: transformTailoredResumeFromDB(updated as TailoredResumeDB)
    });

  } catch (error) {
    console.error('PATCH tailored resume error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE: Remove a tailored resume
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
    const { id } = await params;

    const { error } = await supabase
      .from('tailored_resumes')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('Delete error:', error);
      return NextResponse.json(
        { error: 'Failed to delete tailored resume' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Tailored resume deleted'
    });

  } catch (error) {
    console.error('DELETE tailored resume error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}