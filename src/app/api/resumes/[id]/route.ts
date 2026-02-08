// src/app/api/resumes/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, createSupabaseAdmin } from '@/lib/auth/getAuthUser';
import { Errors } from '@/lib/api/errors';

function safeJsonParse(value: any, fallback: any = null) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function buildAnalysisResults(
  analysisSummary: any,
  keyPoints: any,
  atsScore?: number | null
) {
  if (!analysisSummary && !keyPoints) return null;
  const parsedSummary = analysisSummary || {};
  const parsedKeyPoints = keyPoints || {};

  const overallScore =
    typeof parsedSummary.overallScore === 'number'
      ? parsedSummary.overallScore
      : typeof atsScore === 'number'
      ? atsScore
      : undefined;

  return {
    overallScore: overallScore ?? 0,
    scoreBreakdown: parsedSummary.scoreBreakdown || null,
    recommendations: Array.isArray(parsedSummary.recommendations)
      ? parsedSummary.recommendations
      : [],
    hrPerspective: parsedSummary.hrPerspective || null,
    resumeQuotes: Array.isArray(parsedKeyPoints.resumeQuotes)
      ? parsedKeyPoints.resumeQuotes
      : Array.isArray(parsedSummary.resumeQuotes)
      ? parsedSummary.resumeQuotes
      : [],
    educationalInsights: Array.isArray(parsedKeyPoints.educationalInsights)
      ? parsedKeyPoints.educationalInsights
      : Array.isArray(parsedSummary.educationalInsights)
      ? parsedSummary.educationalInsights
      : [],
    ruleIssues: Array.isArray(parsedSummary.ruleIssues) ? parsedSummary.ruleIssues : []
  };
}

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
    const analysisSummary = safeJsonParse(resume.analysis_summary, null);
    const keyPoints = safeJsonParse(resume.key_points, null);
    const automatedAnalysis = safeJsonParse(resume.automated_analysis, null);
    const analysisResults = buildAnalysisResults(
      analysisSummary,
      keyPoints,
      resume.ats_score
    );

    return NextResponse.json({
      success: true,
      resume: {
        id: resume.id,
        fileName: resume.file_name,
        fullText: resume.full_text,
        extractedText: resume.extracted_text,
        automatedAnalysis,
        analysisSummary,
        keyPoints,
        analysisResults,
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
