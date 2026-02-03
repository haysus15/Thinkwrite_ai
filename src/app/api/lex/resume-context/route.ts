// Resume Context API for Lex Integration
// Provides Lex with access to user's resume information and analysis status

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, createSupabaseAdmin } from '@/lib/auth/getAuthUser';
import { Errors } from '@/lib/api/errors';

// GET /api/lex/resume-context - Get resume context for Lex conversations
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return Errors.unauthorized();
    }

    const supabase = createSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const resumeId = searchParams.get('resumeId');

    let resumeContext = null;

    // If specific resume requested
    if (resumeId) {
      const { data: resume, error } = await supabase
        .from('user_documents')
        .select(`
          *,
          lex_resume_analyses(*)
        `)
        .eq('id', resumeId)
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (error) {
        console.error('Error fetching specific resume:', error);
      } else if (resume) {
        // Parse automated analysis if available
        let automatedAnalysis = null;
        if (resume.analysis_summary) {
          try {
            automatedAnalysis = JSON.parse(resume.analysis_summary);
          } catch (parseError) {
            console.warn('Failed to parse automated analysis:', parseError);
          }
        }

        resumeContext = {
          currentResume: {
            id: resume.id,
            fileName: resume.file_name,
            fileType: resume.file_type,
            uploadedAt: resume.created_at,
            isMaster: resume.is_master_resume,
            automatedAnalysis,
            lexAnalyses: resume.lex_resume_analyses || []
          }
        };
      }
    } else {
      // Get master resume context (default behavior)
      console.log(`🏠 Fetching master resume for user`);
      
      const { data: masterResume, error } = await supabase
        .from('user_documents')
        .select(`
          *,
          lex_resume_analyses(*)
        `)
        .eq('user_id', userId)
        .eq('is_master_resume', true)
        .eq('is_active', true)
        .single();

      if (error) {
        console.warn('No master resume found:', error.message);
      } else if (masterResume) {
        // Parse automated analysis
        let automatedAnalysis = null;
        if (masterResume.analysis_summary) {
          try {
            automatedAnalysis = JSON.parse(masterResume.analysis_summary);
          } catch (parseError) {
            console.warn('Failed to parse master resume analysis:', parseError);
          }
        }

        resumeContext = {
          masterResume: {
            id: masterResume.id,
            fileName: masterResume.file_name,
            fileType: masterResume.file_type,
            uploadedAt: masterResume.created_at,
            automatedAnalysis,
            lexAnalyses: masterResume.lex_resume_analyses || []
          }
        };
      }
    }

    // Get all user resumes for context (regardless of specific resume request)
    console.log(`📄 Fetching all resumes for context`);
    
    const { data: allResumes, error: allResumesError } = await supabase
      .from('user_documents')
      .select('id, file_name, file_type, created_at, analysis_summary, is_master_resume, ats_score')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (allResumesError) {
      console.error('Error fetching all resumes:', allResumesError);
    }

    // Format all resumes for Lex context
    const formattedResumes = allResumes?.map(resume => {
      let hasAnalysis = false;
      let analysisScore = null;
      
      if (resume.analysis_summary) {
        hasAnalysis = true;
        analysisScore = resume.ats_score;
      }

      return {
        id: resume.id,
        fileName: resume.file_name,
        fileType: resume.file_type,
        isMaster: resume.is_master_resume,
        hasAnalysis,
        score: analysisScore,
        uploadedAt: resume.created_at
      };
    }) || [];

    // Determine overall resume status for Lex
    const resumeStatus = {
      hasAnyResumes: formattedResumes.length > 0,
      hasMasterResume: formattedResumes.some(r => r.isMaster),
      totalResumes: formattedResumes.length,
      analyzedResumes: formattedResumes.filter(r => r.hasAnalysis).length,
      averageScore: formattedResumes.length > 0 ? 
        Math.round(formattedResumes.reduce((sum, r) => sum + (r.score || 0), 0) / formattedResumes.length) : 
        null
    };

    console.log(`✅ Resume context compiled:`, {
      hasContext: !!resumeContext,
      totalResumes: formattedResumes.length,
      status: resumeStatus
    });

    return NextResponse.json({
      success: true,
      resumeContext,
      allResumes: formattedResumes,
      resumeStatus,
      contextMetadata: {
        userId,
        requestedResumeId: resumeId,
        contextType: resumeId ? 'specific_resume' : 'master_resume',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error getting resume context for Lex:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to get resume context',
      details: error instanceof Error ? error.message : 'Unknown error',
      resumeContext: null,
      allResumes: [],
      resumeStatus: {
        hasAnyResumes: false,
        hasMasterResume: false,
        totalResumes: 0,
        analyzedResumes: 0,
        averageScore: null
      }
    }, { status: 500 });
  }
}

// POST /api/lex/resume-context - Update resume context or trigger analysis
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return Errors.unauthorized();
    }

    const supabase = createSupabaseAdmin();
    const { resumeId, action } = await request.json();

    switch (action) {
      case 'set_master_resume':
        if (!resumeId) {
          return NextResponse.json({ error: 'Resume ID required for set_master_resume' }, { status: 400 });
        }

        // Clear existing master resume flags
        await supabase
          .from('user_documents')
          .update({ is_master_resume: false })
          .eq('user_id', userId);

        // Set new master resume
        const { error: setMasterError } = await supabase
          .from('user_documents')
          .update({ 
            is_master_resume: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', resumeId)
          .eq('user_id', userId);

        if (setMasterError) {
          throw setMasterError;
        }

        return NextResponse.json({
          success: true,
          message: 'Master resume updated',
          action: 'set_master_resume',
          resumeId
        });

      case 'trigger_analysis':
        if (!resumeId) {
          return NextResponse.json({ error: 'Resume ID required for trigger_analysis' }, { status: 400 });
        }

        // This could trigger the analysis, but for now just return success
        // The actual analysis will be triggered by the calling component
        return NextResponse.json({
          success: true,
          message: 'Analysis request noted',
          action: 'trigger_analysis',
          resumeId,
          nextStep: 'Call resume analysis API to perform analysis'
        });

      case 'mark_for_lex_review':
        if (!resumeId) {
          return NextResponse.json({ error: 'Resume ID required for mark_for_lex_review' }, { status: 400 });
        }

        // Update resume to indicate it needs Lex review
        const { error: markError } = await supabase
          .from('user_documents')
          .update({ 
            lex_review_requested: true,
            lex_review_requested_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', resumeId)
          .eq('user_id', userId);

        if (markError) {
          throw markError;
        }

        return NextResponse.json({
          success: true,
          message: 'Resume marked for Lex review',
          action: 'mark_for_lex_review',
          resumeId
        });

      default:
        return NextResponse.json({
          error: 'Invalid action',
          validActions: ['set_master_resume', 'trigger_analysis', 'mark_for_lex_review']
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Error in resume context POST:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to process resume context action',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// DELETE /api/lex/resume-context - Clear resume context or remove resume
export async function DELETE(request: NextRequest) {
  try {
    // Authenticate user
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return Errors.unauthorized();
    }

    const supabase = createSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const resumeId = searchParams.get('resumeId');
    const action = searchParams.get('action') || 'soft_delete';

    if (action === 'clear_all_context') {
      // Clear all Lex analyses for user (but keep resumes)
      const { error: clearError } = await supabase
        .from('lex_resume_analyses')
        .delete()
        .eq('user_id', userId);

      if (clearError) {
        throw clearError;
      }

      return NextResponse.json({
        success: true,
        message: 'All Lex resume context cleared',
        action: 'clear_all_context'
      });
    }

    if (resumeId) {
      if (action === 'soft_delete') {
        // Mark resume as inactive
        const { error: softDeleteError } = await supabase
          .from('user_documents')
          .update({ 
            is_active: false,
            deleted_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', resumeId)
          .eq('user_id', userId);

        if (softDeleteError) {
          throw softDeleteError;
        }

        return NextResponse.json({
          success: true,
          message: 'Resume marked as inactive',
          action: 'soft_delete',
          resumeId
        });
      } else if (action === 'hard_delete') {
        // Permanently delete resume and all related Lex analyses
        const { error: deleteAnalysesError } = await supabase
          .from('lex_resume_analyses')
          .delete()
          .eq('resume_id', resumeId);

        if (deleteAnalysesError) {
          console.warn('Error deleting Lex analyses:', deleteAnalysesError);
        }

        const { error: deleteResumeError } = await supabase
          .from('user_documents')
          .delete()
          .eq('id', resumeId)
          .eq('user_id', userId);

        if (deleteResumeError) {
          throw deleteResumeError;
        }

        return NextResponse.json({
          success: true,
          message: 'Resume permanently deleted',
          action: 'hard_delete',
          resumeId
        });
      }
    }

    return NextResponse.json({
      error: 'Invalid delete action or missing resume ID',
      validActions: ['soft_delete', 'hard_delete', 'clear_all_context']
    }, { status: 400 });

  } catch (error) {
    console.error('Error in resume context DELETE:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to delete resume context',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}