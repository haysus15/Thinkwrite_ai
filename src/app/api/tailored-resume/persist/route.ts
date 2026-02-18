// Persist Tailored Resume (client-provided snapshot)
// src/app/api/tailored-resume/persist/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, createSupabaseAdmin } from '@/lib/auth/getAuthUser';
import { Errors } from '@/lib/api/errors';
import {
  transformTailoredResumeToDB,
  type TailoredResume,
  type TailoredResumeDB
} from '@/types/tailored-resume';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return Errors.unauthorized();
    }

    const body = await request.json();
    const resume = body?.tailoredResume as TailoredResume | undefined;
    if (!resume) {
      return Errors.validationError('tailoredResume payload required');
    }

    const supabase = createSupabaseAdmin();
    const dbPayload = transformTailoredResumeToDB(resume) as Partial<TailoredResumeDB>;

    dbPayload.user_id = userId;
    dbPayload.job_analysis_id = resume.jobAnalysisId;
    dbPayload.master_resume_id = resume.masterResumeId;
    dbPayload.version_number = resume.versionNumber || 1;
    dbPayload.version_name = resume.versionName ?? null;
    dbPayload.is_finalized = resume.isFinalized ?? false;
    dbPayload.updated_at = new Date().toISOString();
    dbPayload.created_at = resume.createdAt || new Date().toISOString();

    const { data, error } = await supabase
      .from('tailored_resumes')
      .upsert(dbPayload, { onConflict: 'id' })
      .select('id')
      .single();

    if (error) {
      return Errors.databaseError(error.message);
    }

    return NextResponse.json({ success: true, id: data?.id });
  } catch (error: any) {
    console.error('Persist tailored resume error:', error?.message);
    return Errors.internal();
  }
}
