// Job Analysis API Route
// src/app/api/job-analysis/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, createSupabaseAdmin } from '@/lib/auth/getAuthUser';
import { Errors } from '@/lib/api/errors';
import { checkRateLimit } from '@/lib/api/rateLimiter';
import ThinkWriteJobAnalysisEngine from '../../../lib/thinkwrite-job-analysis-engine';

export const runtime = 'nodejs';

const jobAnalysisEngine = new ThinkWriteJobAnalysisEngine();

// POST /api/job-analysis - Analyze job from URL or description
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return Errors.unauthorized();
    }

    // Rate limiting
    const { limited, resetIn } = checkRateLimit(userId, 'job-analysis');
    if (limited) {
      return Errors.rateLimited(Math.ceil(resetIn / 1000));
    }

    const supabase = createSupabaseAdmin();
    const { content, isUrl } = await request.json();

    if (!content) {
      return Errors.missingField('content');
    }

    if (isUrl) {
      try {
        new URL(content);
      } catch {
        return Errors.validationError('Invalid URL format');
      }
    }

    const analysisResult = await jobAnalysisEngine.analyzeJob({
      content,
      isUrl,
      userId,
    });

    if (!analysisResult.success) {
      return Errors.internal(analysisResult.error);
    }

    const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const dbRecord = {
      id: jobId,
      user_id: userId,
      source_content: content,
      source_type: isUrl ? 'url' : 'text',
      job_title: analysisResult.jobDetails?.title || 'Unknown Position',
      company_name: analysisResult.jobDetails?.company || 'Unknown Company',
      location: analysisResult.jobDetails?.location || null,
      job_description: analysisResult.jobDetails?.description || null,
      requirements: analysisResult.jobDetails?.requirements || [],
      responsibilities: analysisResult.jobDetails?.responsibilities || [],
      application_email: analysisResult.jobDetails?.applicationEmail || null,
      ats_keywords: analysisResult.atsKeywords || {},
      hidden_insights: analysisResult.hiddenInsights || {},
      industry_intelligence: analysisResult.industryIntelligence || {},
      company_intelligence: analysisResult.companyIntelligence || {},
      is_saved: false,
      has_applied: false,
      notes: null,
      applied_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: savedJob, error: dbError } = await supabase
      .from('job_analyses')
      .insert(dbRecord)
      .select()
      .single();

    if (dbError) {
      console.error('[Job analysis POST]:', dbError.message);
      // Still return analysis so user doesn't lose the work
    }

    return NextResponse.json({
      success: true,
      jobId,
      analysis: {
        ...analysisResult,
        id: jobId,
      },
    });
  } catch (error: any) {
    console.error('[Job analysis POST]:', error?.message);
    return Errors.internal();
  }
}

// GET /api/job-analysis - Get user's job analyses
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return Errors.unauthorized();
    }

    const supabase = createSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const savedOnly = searchParams.get('saved') === 'true';

    let query = supabase
      .from('job_analyses')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (savedOnly) {
      query = query.eq('is_saved', true);
    }

    const { data: analyses, error } = await query;

    if (error) {
      return Errors.databaseError(error.message);
    }

    return NextResponse.json({
      success: true,
      analyses: analyses || [],
    });
  } catch (error: any) {
    console.error('[Job analysis GET]:', error?.message);
    return Errors.internal();
  }
}
