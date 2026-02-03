// Clean Lex Resume Analysis API Route - Proper Next.js App Router Structure
// src/app/api/resumes/[id]/lex-analysis/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, createSupabaseAdmin } from '@/lib/auth/getAuthUser';
import { Errors } from '@/lib/api/errors';

// Create a simple fallback analysis system since we're having Claude API issues
const generateLexFallbackAnalysis = (resumeText: string, automatedAnalysis: any) => {
  const weakLanguageCount = automatedAnalysis?.resumeQuotes?.filter((q: any) => q.category === 'weak_language').length || 0;
  const missingMetricsCount = automatedAnalysis?.resumeQuotes?.filter((q: any) => q.category === 'missing_metrics').length || 0;
  const score = automatedAnalysis?.overallScore || 50;
  
  let overallRating = 'needs_work';
  if (score >= 80) overallRating = 'strong';
  else if (score >= 65) overallRating = 'solid';
  else if (score >= 50) overallRating = 'needs_improvement';
  
  return {
    analysisId: `lex-fallback-${Date.now()}`,
    timestamp: new Date().toISOString(),
    lexAssessment: {
      overallRating,
      hrManagerPerspective: score >= 70 ? 
        `This resume shows solid experience but could be strengthened with more specific achievements and stronger action verbs.` :
        `From an HR perspective, this resume needs significant improvement to be competitive. The main issues are weak language patterns and lack of quantified achievements.`,
      keyStrengths: score >= 70 ? 
        ['Professional format', 'Relevant experience', 'Skills section present'] :
        ['Basic structure is there', 'Experience is listed', 'Contact information included'],
      criticalWeaknesses: [
        ...(weakLanguageCount > 2 ? [`${weakLanguageCount} instances of weak language like "responsible for"`] : []),
        ...(missingMetricsCount > 1 ? [`Missing quantified achievements - no measurable results`] : []),
        'Needs stronger action verbs and specific accomplishments'
      ],
      marketCompetitiveness: score >= 70 ? 
        'Competitive with improvements' : 
        'Below average - needs significant enhancement to compete effectively',
      industrySpecificInsights: [
        'Add specific metrics and percentages to achievements',
        'Replace passive language with impact-focused verbs',
        'Include relevant technical skills and tools'
      ]
    },
    comparisonWithAutomated: {
      agreementLevel: 'mostly_aligned',
      lexDisagreements: [
        'Automated analysis captures technical issues well',
        'Human review adds context about competitive positioning'
      ],
      additionalInsights: [
        'Consider industry-specific keywords and phrases',
        'Professional tone needs strengthening',
        'Achievement focus vs. duty listing is crucial'
      ],
      humanFactorsNotCaptured: [
        'How achievements will be perceived by hiring managers',
        'Cultural fit indicators in language choice',
        'Career progression story clarity'
      ]
    },
    actionableFeedback: {
      immediateWins: [
        {
          issue: 'Replace weak language',
          solution: 'Change "responsible for" to "managed", "delivered", "achieved"',
          timeToFix: '20-30 minutes',
          impactLevel: 'high',
          lexTip: 'This single change makes you sound more senior and results-focused'
        },
        {
          issue: 'Add quantified achievements',
          solution: 'Include numbers, percentages, dollar amounts for accomplishments',
          timeToFix: '45-60 minutes', 
          impactLevel: 'high',
          lexTip: 'HR managers need proof of impact - "increased sales by 15%" beats "improved sales"'
        }
      ],
      strategicRecommendations: [
        'Focus on measurable results in every bullet point',
        'Use industry-specific keywords from job descriptions',
        'Tell a clear story of career progression and growth'
      ],
      conversationStarters: [
        'What specific results are you most proud of?',
        'Which achievements had the biggest business impact?',
        'What numbers can we add to quantify your accomplishments?'
      ]
    },
    conversationFlow: {
      suggestedQuestions: [
        'What surprised you about this analysis?',
        'Which improvement would you want to tackle first?',
        'What questions do you have about the feedback?'
      ],
      discussionPoints: [
        'Weak language patterns and how to fix them',
        'Adding quantified achievements',
        'Industry-specific positioning'
      ],
      coachingMode: score >= 70 ? 'strategic' : score >= 50 ? 'encouraging' : 'tough_love'
    }
  };
};

// GET handler for retrieving Lex analysis
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
    const { searchParams } = new URL(request.url);
    const includeLexReview = searchParams.get('includeLexReview') === 'true';

    // Get resume data
    const { data: resume, error } = await supabase
      .from('user_documents')
      .select('*')
      .eq('id', resumeId)
      .eq('user_id', userId)
      .single();

    if (error || !resume) {
      console.error('Resume not found:', error);
      return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
    }

    // Parse automated analysis
    let automatedAnalysis = null;
    if (resume.analysis_summary) {
      try {
        automatedAnalysis = JSON.parse(resume.analysis_summary);
        console.log('📊 Found existing automated analysis with score:', automatedAnalysis.overallScore);
      } catch (parseError) {
        console.warn('Failed to parse existing analysis:', parseError);
      }
    }

    const response: any = {
      success: true,
      resume: {
        id: resume.id,
        fileName: resume.file_name,
        fileType: resume.file_type,
        text: resume.extracted_text,
        uploadedAt: resume.created_at
      },
      automatedAnalysis
    };

    // Generate Lex analysis if requested
    if (includeLexReview) {
      console.log('🎯 Generating Lex HR expert analysis (fallback mode)');
      
      const lexAnalysis = generateLexFallbackAnalysis(
        resume.extracted_text || '',
        automatedAnalysis
      );

      response.lexAnalysis = lexAnalysis;
      
      // Generate conversation starters based on the analysis
      const conversationStarters = [
        `I've analyzed your resume "${resume.file_name}" alongside the automated scoring.`,
        automatedAnalysis?.overallScore ? 
          `The system scored it ${automatedAnalysis.overallScore}/100, which I think is ${lexAnalysis.lexAssessment.overallRating === 'strong' ? 'fair' : 'actually about right'}.` :
          'Let me share my HR perspective on what I see.',
        'Want to discuss the biggest opportunities for improvement?'
      ];

      response.conversationStarters = conversationStarters;
      response.discussionPrompts = lexAnalysis.conversationFlow.discussionPoints;

      // Store the analysis for future reference
      try {
        await supabase
          .from('lex_resume_analyses')
          .upsert({
            resume_id: resumeId,
            user_id: userId,
            analysis_type: 'fallback_analysis',
            lex_analysis: JSON.stringify(lexAnalysis),
            created_at: new Date().toISOString()
          });
        console.log('✅ Stored Lex analysis in database');
      } catch (dbError) {
        console.warn('Failed to store Lex analysis:', dbError);
        // Continue anyway - analysis was successful
      }
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error in Lex analysis endpoint:', error);
    return NextResponse.json({
      success: false,
      error: 'Analysis failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// POST handler for triggering new analysis
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return Errors.unauthorized();
    }

    const { id: resumeId } = await params;
    const { reviewType } = await request.json();

    // For now, redirect to GET with includeLexReview=true
    const analysisUrl = `/api/resumes/${resumeId}/lex-analysis?includeLexReview=true`;
    
    return NextResponse.json({
      success: true,
      message: 'Analysis triggered',
      redirectTo: analysisUrl
    });

  } catch (error) {
    console.error('Error in Lex review POST:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to trigger review'
    }, { status: 500 });
  }
}