// Resume Builder [id] API Route
// src/app/api/resume-builder/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, createSupabaseAdmin } from '@/lib/auth/getAuthUser';
import { Errors } from '@/lib/api/errors';
import { transformResumeToDB } from '@/types/resume-builder';
import type { ResumeBuilderData } from '@/types/resume-builder';

// GET: Fetch a single resume
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

    const { data, error } = await supabase
      .from('user_documents')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: 'Resume not found' },
        { status: 404 }
      );
    }

    // Transform from DB format to app format
    const resume: ResumeBuilderData = {
      id: data.id,
      userId: data.user_id,
      title: data.title || data.file_name || 'Untitled',
      targetRole: data.target_role,
      targetIndustry: data.target_industry,
      contactInfo: data.contact_info || { name: '', email: '', phone: '', location: '' },
      summary: data.summary || '',
      experience: data.experience || [],
      education: data.education || [],
      skills: data.skills || [],
      projects: data.projects || [],
      certifications: data.certifications || [],
      sectionStatuses: data.section_statuses || {
        contact: 'empty',
        summary: 'empty',
        experience: 'empty',
        education: 'empty',
        skills: 'empty',
        projects: 'empty',
        certifications: 'empty'
      },
      sectionFeedback: data.section_feedback || {},
      isDraft: data.is_draft ?? true,
      isMasterResume: data.is_master_resume ?? false,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };

    return NextResponse.json({
      success: true,
      resume: {
        ...resume,
        rawImportedText: data.extracted_text || null
      }
    });

  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch resume' },
      { status: 500 }
    );
  }
}

// PUT: Update a resume
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
    const { id } = await params;
    const body: ResumeBuilderData = await request.json();

    const dbData = transformResumeToDB(body);

    const { data, error } = await supabase
      .from('user_documents')
      .update({
        ...dbData,
        title: body.title,
        file_name: body.title || 'Untitled Resume',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Update error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, resume: { ...body, id: data.id } });

  } catch (error) {
    console.error('PUT error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update resume' },
      { status: 500 }
    );
  }
}

// DELETE: Delete a resume
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
      .from('user_documents')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('Delete error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete resume' },
      { status: 500 }
    );
  }
}
