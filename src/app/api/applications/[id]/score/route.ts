// Application Packet Scoring API
// src/app/api/applications/[id]/score/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, createSupabaseAdmin } from '@/lib/auth/getAuthUser';
import { Errors } from '@/lib/api/errors';
import { RigorousConsistentScoringEngine } from '@/lib/educational-scoring-engine';

export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: applicationId } = await params;
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) return Errors.unauthorized();

    const supabase = createSupabaseAdmin();
    const { data: application, error: appError } = await supabase
      .from('applications')
      .select('id, user_id, job_analysis_id, tailored_resume_id, cover_letter_id')
      .eq('id', applicationId)
      .eq('user_id', userId)
      .single();

    if (appError || !application) return Errors.notFound('Application');

    const { data: draftRow } = await supabase
      .from('application_tailored_drafts')
      .select('*')
      .eq('application_id', applicationId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!draftRow?.draft_content) {
      return NextResponse.json({
        success: false,
        error: 'No tailored resume draft found for this application'
      }, { status: 400 });
    }

    const engine = new RigorousConsistentScoringEngine();
    const resumeAnalysis = await engine.analyzeResume(draftRow.draft_content, 'Application Tailored Resume');
    const resumeScore = resumeAnalysis.overallScore ?? 0;

    const { data: coverLetter } = await supabase
      .from('cover_letters')
      .select('overall_quality_score, voice_match_score, job_alignment_score, content')
      .eq('id', application.cover_letter_id)
      .eq('user_id', userId)
      .maybeSingle();

    const coverLetterScore = typeof coverLetter?.overall_quality_score === 'number'
      ? coverLetter.overall_quality_score
      : 0;
    const coverLetterBreakdown = {
      overall: coverLetter?.overall_quality_score ?? null,
      voiceMatch: coverLetter?.voice_match_score ?? null,
      jobAlignment: coverLetter?.job_alignment_score ?? null
    };

    const applicationScore = Math.round((resumeScore * 0.6) + (coverLetterScore * 0.4));

    const scoreJson = {
      resumeScore,
      coverLetterScore,
      applicationScore,
      scoredAt: new Date().toISOString()
    };

    await supabase
      .from('application_tailored_drafts')
      .update({
        score_json: scoreJson,
        last_scored_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('application_id', applicationId)
      .eq('user_id', userId);

    return NextResponse.json({
      success: true,
      score: scoreJson,
      resumeAnalysis,
      coverLetterScore,
      coverLetterBreakdown
    });
  } catch (error: any) {
    console.error('[Application score]:', error?.message);
    return Errors.internal();
  }
}
