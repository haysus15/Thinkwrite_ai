// Resume Builder API Route
// src/app/api/resume-builder/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, createSupabaseAdmin } from '@/lib/auth/getAuthUser';
import { Errors } from '@/lib/api/errors';
import { transformResumeToDB } from '@/types/resume-builder';
import type { ResumeBuilderData } from '@/types/resume-builder';
// VOICE DISCONNECTED — Mirror Mode ships standalone. Reconnect via API contract.

// GET: List all resumes built by user
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return Errors.unauthorized();
    }

    const supabase = createSupabaseAdmin();

    const { data, error } = await supabase
      .from('user_documents')
      .select('*')
      .eq('user_id', userId)
      .eq('source', 'builder')
      .order('updated_at', { ascending: false });

    if (error) {
      return Errors.databaseError(error.message);
    }

    const resumes = (data || []).map((doc: any) => ({
      id: doc.id,
      title: doc.title || 'Untitled Resume',
      targetRole: doc.target_role,
      isDraft: doc.is_draft,
      isMasterResume: doc.is_master_resume,
      updatedAt: doc.updated_at,
      createdAt: doc.created_at
    }));

    return NextResponse.json({ success: true, resumes });

  } catch (error: any) {
    console.error('[Resume builder GET]:', error?.message);
    return Errors.internal();
  }
}

// POST: Create a new resume
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return Errors.unauthorized();
    }

    const supabase = createSupabaseAdmin();
    const body: ResumeBuilderData = await request.json();

    // Use authenticated userId, not body.userId
    const dbData = transformResumeToDB({ ...body, userId });

    const { data, error } = await supabase
      .from('user_documents')
      .insert({
        ...dbData,
        extracted_text: body.rawImportedText || dbData.extracted_text || null,
        file_name: body.title || 'Untitled Resume',
        file_type: 'builder',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      return Errors.databaseError(error.message);
    }


    // Mirror Mode: Register lineage (best effort)
    try {
      await supabase
        .from('document_lineage')
        .insert({
          user_id: userId,
          original_document_id: data.id,
          studio_origin: 'career',
          current_version_id: data.id,
          version_history: [
            {
              version_type: 'original',
              document_id: data.id,
              source_studio: 'career',
              document_type: 'resume_builder',
              created_at: new Date().toISOString(),
            },
          ],
        });
    } catch (e) {
      // Silent fail
    }

    return NextResponse.json({
      success: true,
      resume: { ...body, id: data.id, userId },
    });

  } catch (error: any) {
    console.error('[Resume builder POST]:', error?.message);
    return Errors.internal();
  }
}
