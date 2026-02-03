// Resume API Route
// src/app/api/resumes/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, createSupabaseAdmin } from '@/lib/auth/getAuthUser';
import { Errors } from '@/lib/api/errors';
import mammoth from 'mammoth';
import ContentAwareEducationalScoringEngine from '../../../lib/educational-scoring-engine';

const scoringEngine = new ContentAwareEducationalScoringEngine();

// Utility function to clean text content
function cleanTextContent(text: string): string {
  return text
    .replace(/\u0000/g, '')
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\uFEFF/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Safe JSON parser for legacy data
function safeJsonParse(jsonString: string, fallbackData: any = null) {
  try {
    if (typeof jsonString === 'object') {
      return jsonString;
    }
    return JSON.parse(jsonString);
  } catch (error) {
    return fallbackData;
  }
}

// GET - List user's resumes
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return Errors.unauthorized();
    }

    const supabase = createSupabaseAdmin();

    const { data: resumes, error } = await supabase
      .from('user_documents')
      .select(`
        id,
        file_name,
        file_type,
        file_size,
        is_master_resume,
        created_at,
        analysis_summary,
        ats_score,
        recommendations,
        extracted_text
      `)
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      return Errors.databaseError(error.message);
    }

    // Transform data with improved legacy handling
    const formattedResumes = resumes?.map(resume => {
      let analysisResults = null;

      // Enhanced legacy data parsing
      if (resume.analysis_summary && resume.ats_score) {
        const parsedAnalysis = safeJsonParse(resume.analysis_summary, {
          isLegacy: true,
          overallScore: resume.ats_score || 0,
          error: 'Legacy analysis format - re-analyze for detailed insights'
        });

        if (parsedAnalysis) {
          analysisResults = {
            overallScore: resume.ats_score || parsedAnalysis.overallScore || 0,
            scoreBreakdown: parsedAnalysis.scoreBreakdown || {
              formatting: { score: Math.floor((resume.ats_score || 0) * 0.25), maxScore: 25, level: 'needs_improvement' as const, explanation: 'Legacy data - re-analyze for current insights', whyItMatters: 'Click re-analyze for detailed breakdown', specificIssues: ['Legacy analysis format'], positivePoints: [], examplesFromResume: [] },
              keywords: { score: Math.floor((resume.ats_score || 0) * 0.30), maxScore: 30, level: 'needs_improvement' as const, explanation: 'Legacy data - re-analyze for current insights', whyItMatters: 'Click re-analyze for detailed breakdown', specificIssues: ['Legacy analysis format'], positivePoints: [], examplesFromResume: [] },
              content: { score: Math.floor((resume.ats_score || 0) * 0.25), maxScore: 25, level: 'needs_improvement' as const, explanation: 'Legacy data - re-analyze for current insights', whyItMatters: 'Click re-analyze for detailed breakdown', specificIssues: ['Legacy analysis format'], positivePoints: [], examplesFromResume: [] },
              atsCompatibility: { score: Math.floor((resume.ats_score || 0) * 0.20), maxScore: 20, level: 'needs_improvement' as const, explanation: 'Legacy data - re-analyze for current insights', whyItMatters: 'Click re-analyze for detailed breakdown', specificIssues: ['Legacy analysis format'], positivePoints: [], examplesFromResume: [] }
            },
            recommendations: Array.isArray(parsedAnalysis.recommendations) ? parsedAnalysis.recommendations : [],
            hrPerspective: parsedAnalysis.hrPerspective || {
              firstImpression: "Legacy analysis available - click 'Re-analyze' for current insights",
              likelyOutcome: 'maybe_advance' as const,
              timeToReview: "6-10 seconds",
              standoutElements: [],
              concerningElements: ['Legacy analysis format - needs re-analysis for detailed insights'],
              overallAssessment: "Re-analyze with current AI system for detailed content-specific feedback"
            },
            resumeQuotes: parsedAnalysis.resumeQuotes || [],
            educationalInsights: parsedAnalysis.educationalInsights || []
          };
        }
      }

      return {
        id: resume.id,
        fileName: resume.file_name,
        fileType: resume.file_type,
        fileSize: resume.file_size || 0,
        isMasterResume: resume.is_master_resume || false,
        uploadedAt: new Date(resume.created_at),
        analysisResults,
        analysisStatus: analysisResults ? 'complete' : 'pending',
        hasLegacyAnalysis: !!(resume.analysis_summary && (!analysisResults?.resumeQuotes || analysisResults.resumeQuotes.length === 0))
      };
    }) || [];

    const masterResume = formattedResumes.find(r => r.isMasterResume) || null;

    return NextResponse.json({
      success: true,
      resumes: formattedResumes,
      masterResume,
    });

  } catch (error: any) {
    console.error('[Resumes GET]:', error?.message);
    return Errors.internal();
  }
}

// POST - Upload new resume
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return Errors.unauthorized();
    }

    const supabase = createSupabaseAdmin();
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return Errors.missingField('file');
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];

    if (!allowedTypes.includes(file.type)) {
      return Errors.validationError('Invalid file type. Please upload PDF, DOCX, or TXT files.');
    }

    if (file.size > 10 * 1024 * 1024) {
      return Errors.validationError('File size must be less than 10MB');
    }

    // Extract file content
    let rawFileContent: string;
    try {
      if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ buffer: Buffer.from(arrayBuffer) });
        rawFileContent = result.value;

        if (rawFileContent.length < 50) {
          throw new Error('DOCX extraction returned insufficient content');
        }
      } else if (file.type === 'application/pdf') {
        rawFileContent = await file.text();

        if (rawFileContent.length < 50 || rawFileContent.includes('%PDF')) {
          return Errors.validationError('PDF text extraction not fully supported. Please upload as DOCX or TXT.');
        }
      } else {
        rawFileContent = await file.text();
      }
    } catch (fileReadError) {
      return Errors.badRequest('Failed to extract text from file. Please ensure the file is not corrupted.');
    }

    const cleanedContent = cleanTextContent(rawFileContent);

    // Check if this is the user's first resume
    const { data: existingResumes } = await supabase
      .from('user_documents')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true);

    const isFirstResume = !existingResumes || existingResumes.length === 0;

    // Analyze with content-aware engine
    try {
      const analysisResults = await scoringEngine.analyzeResume(cleanedContent, file.name);

      // Store in database
      const insertPayload = {
        user_id: userId,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        extracted_text: cleanedContent,
        is_master_resume: isFirstResume,
        is_active: true,
        analysis_summary: JSON.stringify(analysisResults),
        ats_score: analysisResults.overallScore,
        recommendations: JSON.stringify(analysisResults.recommendations || []),
        key_points: JSON.stringify({
          resumeQuotes: analysisResults.resumeQuotes || [],
          educationalInsights: analysisResults.educationalInsights || []
        }),
        upload_source: 'resume_manager'
      };

      const { data: newResume, error: insertError } = await insertResumeWithFallback(
        supabase,
        insertPayload
      );

      if (insertError || !newResume) {
        return Errors.databaseError(insertError?.message || 'Insert failed');
      }

      return NextResponse.json({
        success: true,
        message: isFirstResume ?
          `${file.name} uploaded and set as Master Resume!` :
          `${file.name} uploaded successfully!`,
        resume: {
          id: newResume.id,
          fileName: newResume.file_name,
          fileType: newResume.file_type,
          fileSize: newResume.file_size,
          isMasterResume: newResume.is_master_resume,
          uploadedAt: new Date(newResume.created_at),
          analysisResults: analysisResults,
          analysisStatus: 'complete',
          hasLegacyAnalysis: false
        }
      });

    } catch (analysisError) {
      // Still save the resume without analysis
      const fallbackPayload = {
        user_id: userId,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        extracted_text: cleanedContent,
        is_master_resume: isFirstResume,
        is_active: true,
        analysis_summary: JSON.stringify({
          error: 'Analysis failed',
          errorDetails: analysisError instanceof Error ? analysisError.message : 'Unknown error'
        }),
        ats_score: 0,
        upload_source: 'resume_manager'
      };

      const { data: newResume, error: insertError } = await insertResumeWithFallback(
        supabase,
        fallbackPayload
      );

      return NextResponse.json({
        success: true,
        message: 'Resume uploaded but analysis failed. You can re-analyze later.',
        resume: {
          id: newResume?.id,
          fileName: newResume?.file_name,
          fileType: newResume?.file_type,
          fileSize: newResume?.file_size,
          isMasterResume: newResume?.is_master_resume,
          uploadedAt: newResume ? new Date(newResume.created_at) : new Date(),
          analysisResults: null,
          analysisStatus: 'error',
          hasLegacyAnalysis: false
        }
      });
    }

  } catch (error: any) {
    console.error('[Resumes POST]:', error?.message);
    return Errors.internal();
  }
}

// PUT - Re-analyze existing resume
export async function PUT(request: NextRequest) {
  try {
    // Authenticate user
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return Errors.unauthorized();
    }

    const body = await request.json();
    const { resumeId } = body;

    if (!resumeId) {
      return Errors.missingField('resumeId');
    }

    const supabase = createSupabaseAdmin();

    // Get the resume
    const { data: resume, error: fetchError } = await supabase
      .from('user_documents')
      .select('*')
      .eq('id', resumeId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !resume) {
      return Errors.notFound('Resume');
    }

    const contentToAnalyze = resume.extracted_text;

    // Check if we have content
    if (!contentToAnalyze || contentToAnalyze.trim().length < 50) {
      return Errors.badRequest('Resume content not found. Please re-upload the file.');
    }

    // Clean the content before analysis
    const cleanedContent = cleanTextContent(contentToAnalyze);

    // Re-analyze with content-aware engine
    const analysisResults = await scoringEngine.analyzeResume(cleanedContent, resume.file_name);

    // Update the analysis
    const { error: updateError } = await supabase
      .from('user_documents')
      .update({
        analysis_summary: JSON.stringify(analysisResults),
        ats_score: analysisResults.overallScore,
        recommendations: JSON.stringify(analysisResults.recommendations || []),
        key_points: JSON.stringify({
          resumeQuotes: analysisResults.resumeQuotes || [],
          educationalInsights: analysisResults.educationalInsights || []
        }),
        updated_at: new Date().toISOString()
      })
      .eq('id', resumeId);

    if (updateError) {
      return Errors.databaseError(updateError.message);
    }

    return NextResponse.json({
      success: true,
      message: `${resume.file_name} re-analyzed successfully!`,
      analysis: analysisResults,
      quotesFound: analysisResults.resumeQuotes?.length || 0,
      score: analysisResults.overallScore
    });

  } catch (error: any) {
    console.error('[Resumes PUT]:', error?.message);
    return Errors.internal();
  }
}

type SupabaseLike = ReturnType<typeof createSupabaseAdmin>;

async function insertResumeWithFallback(
  supabase: SupabaseLike,
  payload: Record<string, any>
) {
  let currentPayload = { ...payload };
  let result = await supabase.from('user_documents').insert(currentPayload).select().single();

  if (!result.error) {
    return result;
  }

  const errorMessage = result.error.message || '';
  const missingColumn = errorMessage.includes('column') || errorMessage.includes('does not exist');

  if (!missingColumn) {
    return result;
  }

  const optionalKeys = [
    'recommendations',
    'key_points',
    'upload_source',
    'analysis_summary',
    'ats_score',
    'file_size',
    'extracted_text',
    'is_master_resume',
    'is_active'
  ];

  for (const key of optionalKeys) {
    if (!(key in currentPayload)) continue;
    const { [key]: _removed, ...nextPayload } = currentPayload;
    currentPayload = nextPayload;
    result = await supabase.from('user_documents').insert(currentPayload).select().single();
    if (!result.error) {
      return result;
    }
  }

  return result;
}
