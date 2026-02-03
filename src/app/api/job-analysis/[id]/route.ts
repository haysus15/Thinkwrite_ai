// Additional Job Analysis API Endpoints
// src/app/api/job-analysis/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, createSupabaseAdmin } from '@/lib/auth/getAuthUser';
import { Errors } from '@/lib/api/errors';

// Transform database record to frontend format
function transformToFrontendFormat(dbRecord: any) {
  return {
    id: dbRecord.id,
    success: true,
    jobDetails: {
      title: dbRecord.job_title || 'Unknown Position',
      company: dbRecord.company_name || 'Unknown Company',
      location: dbRecord.location || '',
      description: dbRecord.job_description || '',
      requirements: dbRecord.requirements || [],
      responsibilities: dbRecord.responsibilities || [],
      applicationEmail: dbRecord.application_email || null
    },
    atsKeywords: dbRecord.ats_keywords || {
      hardSkills: [],
      softSkills: [],
      technologies: [],
      certifications: [],
      educationRequirements: [],
      experienceKeywords: [],
      industryKeywords: [],
      actionWords: [],
      atsScore: 0
    },
    hiddenInsights: dbRecord.hidden_insights || {
      phraseTranslations: [],
      urgencyIndicators: [],
      cultureClues: [],
      compensationSignals: []
    },
    industryIntelligence: dbRecord.industry_intelligence || {
      sector: '',
      hiringPatterns: [],
      buzzwordMeanings: [],
      applicationTips: []
    },
    companyIntelligence: dbRecord.company_intelligence || {
      companyStage: '',
      teamSize: '',
      recentNews: [],
      cultureIndicators: []
    },
    // Include metadata
    isSaved: dbRecord.is_saved || false,
    hasApplied: dbRecord.has_applied || false,
    appliedAt: dbRecord.applied_at || null,
    notes: dbRecord.notes || null,
    createdAt: dbRecord.created_at,
    updatedAt: dbRecord.updated_at
  };
}

// GET /api/job-analysis/[id] - Get specific job analysis
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

    const { data: analysis, error } = await supabase
      .from('job_analyses')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error || !analysis) {
      console.error('Analysis fetch error:', error);
      return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
    }

    // Transform to frontend format
    const transformedAnalysis = transformToFrontendFormat(analysis);

    return NextResponse.json({
      success: true,
      analysis: transformedAnalysis
    });

  } catch (error) {
    console.error('Get analysis error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// PATCH /api/job-analysis/[id] - Update analysis (save/unsave, mark applied)
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
    const { id: jobId } = await params;
    const updates = await request.json();

    // First check if the record exists
    const { data: existing, error: findError } = await supabase
      .from('job_analyses')
      .select('id')
      .eq('id', jobId)
      .eq('user_id', userId)
      .maybeSingle();

    if (findError) {
      console.error('Find error:', findError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!existing) {
      console.log(`⚠️ Job ${jobId} not found for user ${userId}`);
      return NextResponse.json({ error: 'Job analysis not found' }, { status: 404 });
    }

    // Now update
    const { data, error } = await supabase
      .from('job_analyses')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)
      .eq('user_id', userId)
      .select()
      .maybeSingle();

    if (error) {
      console.error('Update failed:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('✅ Job analysis updated:', jobId);
    return NextResponse.json({ success: true, data });

  } catch (error) {
    console.error('PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/job-analysis/[id] - Delete job analysis
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
      .from('job_analyses')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('Delete failed:', error);
      return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Analysis deleted'
    });

  } catch (error) {
    console.error('Delete analysis error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}