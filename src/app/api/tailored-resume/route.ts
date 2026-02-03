// Tailored Resume API Route
// src/app/api/tailored-resume/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, createSupabaseAdmin } from '@/lib/auth/getAuthUser';
import { Errors } from '@/lib/api/errors';
import { checkRateLimit } from '@/lib/api/rateLimiter';
import { TailoredResumeEngine } from '@/lib/tailored-resume-engine';
import { learnFromTextDirect } from '@/lib/mirror-mode/liveLearning';
import { VoiceProfileService } from '@/services/voice-profile';
import {
  transformTailoredResumeFromDB,
  type TailoredResumeDB,
  type CreateTailoredResumeRequest
} from '@/types/tailored-resume';

// POST: Generate a new tailored resume
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return Errors.unauthorized();
    }

    // Rate limiting
    const { limited, resetIn } = checkRateLimit(userId, 'tailored-resume');
    if (limited) {
      return Errors.rateLimited(Math.ceil(resetIn / 1000));
    }

    const voiceContext = await VoiceProfileService.getGenerationContext(userId, "career");
    const systemPrompt = `You are Lex, a career advisor with deep HR expertise. You help users craft authentic, compelling career documents that showcase their real experience and value.

Your approach:
- Guide through conversation, don't auto-generate fabricated content
- Help users articulate their actual achievements powerfully
- Be direct but supportive, like a trusted mentor
- Focus on what makes this person uniquely valuable

${voiceContext.promptInjection}

${voiceContext.readiness.shouldWarn ? `Note: ${voiceContext.readiness.lexMessage}` : ''}`;

    const supabase = createSupabaseAdmin();
    const body: CreateTailoredResumeRequest = await request.json();
    const { jobAnalysisId, masterResumeId, tailoringLevel, versionName } = body;

    // Validate required fields
    if (!jobAnalysisId || !masterResumeId || !tailoringLevel) {
      return Errors.validationError('Missing required fields: jobAnalysisId, masterResumeId, tailoringLevel');
    }

    // Step 1: Fetch the master resume
    const { data: masterResume, error: resumeError } = await supabase
      .from('user_documents')
      .select('*')
      .eq('id', masterResumeId)
      .eq('user_id', userId)
      .single();

    if (resumeError || !masterResume) {
      console.error('Resume fetch error:', resumeError);
      return NextResponse.json(
        { error: 'Master resume not found' },
        { status: 404 }
      );
    }

    // Step 2: Fetch the job analysis
    const { data: jobAnalysis, error: jobError } = await supabase
      .from('job_analyses')
      .select('*')
      .eq('id', jobAnalysisId)
      .eq('user_id', userId)
      .single();

    if (jobError || !jobAnalysis) {
      console.error('Job analysis fetch error:', jobError);
      return NextResponse.json(
        { error: 'Job analysis not found' },
        { status: 404 }
      );
    }

    // Step 3: Get the next version number for this job
    const { data: existingVersions } = await supabase
      .from('tailored_resumes')
      .select('version_number')
      .eq('user_id', userId)
      .eq('job_analysis_id', jobAnalysisId)
      .order('version_number', { ascending: false })
      .limit(1);

    const nextVersionNumber = (existingVersions?.[0]?.version_number || 0) + 1;

    // Step 4: Prepare job analysis data for the engine
    const jobAnalysisForEngine = {
      jobTitle: jobAnalysis.job_title,
      company: jobAnalysis.company_name,
      description: jobAnalysis.job_description || '',
      requirements: jobAnalysis.requirements || [],
      responsibilities: jobAnalysis.responsibilities || [],
      atsKeywords: {
        hardSkills: jobAnalysis.ats_keywords?.hardSkills?.map((s: any) => 
          typeof s === 'string' ? s : s.skill
        ) || [],
        softSkills: jobAnalysis.ats_keywords?.softSkills?.map((s: any) => 
          typeof s === 'string' ? s : s.skill
        ) || [],
        technologies: jobAnalysis.ats_keywords?.technologies?.map((t: any) => 
          typeof t === 'string' ? t : t.technology
        ) || [],
        experienceKeywords: jobAnalysis.ats_keywords?.experienceKeywords?.map((e: any) => 
          typeof e === 'string' ? e : e.keyword
        ) || []
      },
      hiddenInsights: jobAnalysis.hidden_insights
    };

    // Step 5: Run the tailoring engine
    const engine = new TailoredResumeEngine();
    const result = await engine.generateTailoredResume({
      masterResumeText: masterResume.extracted_text || '',
      tailoringLevel,
      jobAnalysis: jobAnalysisForEngine,
      voiceSystemPrompt: systemPrompt
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Tailoring failed' },
        { status: 500 }
      );
    }

    // Step 6: Save to database
    const { data: tailoredResume, error: saveError } = await supabase
      .from('tailored_resumes')
      .insert({
        user_id: userId,
        job_analysis_id: jobAnalysisId,
        master_resume_id: masterResumeId,
        version_number: nextVersionNumber,
        version_name: versionName || `Version ${nextVersionNumber}`,
        tailoring_level: tailoringLevel,
        original_content: result.originalContent,
        tailored_content: result.tailoredContent,
        changes: result.changes,
        changes_pending: result.changes.length,
        changes_accepted: 0,
        changes_rejected: 0,
        lex_commentary: result.lexCommentary,
        lex_overall_assessment: result.lexCommentary.overallAssessment,
        is_finalized: false
      })
      .select()
      .single();

    if (saveError) {
      console.error('Save error:', saveError);
      return NextResponse.json(
        { error: 'Failed to save tailored resume' },
        { status: 500 }
      );
    }

    console.log(`✅ Tailored resume created: ${tailoredResume.id}`);

    // Mirror Mode: Learn from tailored resume content (fire-and-forget)
    try {
      // Extract text from tailored content for voice learning
      const tailoredContent = result.tailoredContent;
      const textForLearning = [
        tailoredContent?.summary?.content,
        ...(tailoredContent?.experience?.jobs?.flatMap((job: any) =>
          job.bullets?.map((b: any) => b.content) || []
        ) || [])
      ].filter(Boolean).join('\n');

      if (textForLearning.length > 100) {
        await learnFromTextDirect({
          userId,
          text: textForLearning,
          source: 'tailored-resume',
          metadata: {
            documentId: tailoredResume.id,
            title: `Tailored for ${jobAnalysis.job_title} at ${jobAnalysis.company_name}`,
            context: `level:${tailoringLevel}`
          }
        });
        console.log('🔮 Mirror Mode: Learned from tailored resume');
      }
    } catch (e) {
      console.log('Mirror Mode learning skipped:', e);
      // Don't throw - learning failure shouldn't break main feature
    }

    return NextResponse.json({
      success: true,
      tailoredResume: transformTailoredResumeFromDB(tailoredResume as TailoredResumeDB),
      voiceMetadata: {
        usedVoiceProfile: voiceContext.hasVoiceProfile && voiceContext.readiness.isReady,
        confidenceLevel: voiceContext.readiness.score,
        shouldAskFeedback: voiceContext.readiness.shouldWarn,
      }
    });

  } catch (error) {
    console.error('Tailored resume API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET: List user's tailored resumes
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return Errors.unauthorized();
    }

    const supabase = createSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const jobAnalysisId = searchParams.get('jobAnalysisId');

    let query = supabase
      .from('tailored_resumes')
      .select(`
        *,
        job_analyses!inner(job_title, company_name),
        user_documents!inner(file_name)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Filter by specific job if provided
    if (jobAnalysisId) {
      query = query.eq('job_analysis_id', jobAnalysisId);
    }

    const { data: tailoredResumes, error } = await query;

    if (error) {
      console.error('Fetch error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch tailored resumes' },
        { status: 500 }
      );
    }

    // Transform and enrich with related data
    const enrichedResumes = tailoredResumes.map(tr => ({
      ...transformTailoredResumeFromDB(tr as TailoredResumeDB),
      jobTitle: tr.job_analyses?.job_title,
      company: tr.job_analyses?.company_name,
      masterResumeFileName: tr.user_documents?.file_name
    }));

    return NextResponse.json({
      success: true,
      tailoredResumes: enrichedResumes,
      total: enrichedResumes.length
    });

  } catch (error) {
    console.error('GET tailored resumes error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
