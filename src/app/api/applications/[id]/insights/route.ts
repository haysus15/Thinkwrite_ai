// Application Insights API Route
// src/app/api/applications/[id]/insights/route.ts

import { NextResponse } from "next/server";
import { getAuthUser, createSupabaseAdmin } from "@/lib/auth/getAuthUser";
import { Errors } from "@/lib/api/errors";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return Errors.unauthorized();
    }

    const { id: applicationId } = await params;
    const supabase = createSupabaseAdmin();

    // Query the view
    const { data, error } = await supabase
      .from("application_insights")
      .select("*")
      .eq("id", applicationId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      return Errors.databaseError(error.message);
    }

    if (!data) {
      return NextResponse.json({
        success: true,
        hasJobAnalysis: false,
        hasTailoredResume: false,
        hasCoverLetter: false,
        applicationReady: false,
        interviewReadyComplete: false,
      });
    }

    // Return the insights
    return NextResponse.json({
      success: true,

      // Existence flags
      hasJobAnalysis: data.has_job_analysis || false,
      hasTailoredResume: data.has_tailored_resume || false,
      hasCoverLetter: data.has_cover_letter || false,

      // Job Analysis data
      hiddenInsights: data.hidden_insights || null,
      industryIntelligence: data.industry_intelligence || null,
      companyIntelligence: data.company_intelligence || null,
      atsKeywords: data.ats_keywords || null,
      requirements: data.requirements || null,

      // Tailored Resume data
      tailoringLevel: data.tailoring_level || null,
      changesAccepted: data.changes_accepted || 0,
      changesRejected: data.changes_rejected || 0,
      changesPending: data.changes_pending || 0,
      resumeLexAssessment: data.resume_lex_assessment || null,
      resumeFinalized: data.resume_finalized || false,
      resumeVersion: data.resume_version || null,

      // Cover Letter data
      voiceMatchScore: data.voice_match_score || null,
      jobAlignmentScore: data.job_alignment_score || null,
      overallQualityScore: data.overall_quality_score || null,
      coverLetterLexSuggestions: data.cover_letter_lex_suggestions || null,

      // Readiness flags
      applicationReady: data.application_ready || false,
      interviewReadyComplete: data.interview_ready_complete || false,

      // Next reminder
      nextReminder: data.next_reminder || null,
    });
  } catch (e: any) {
    console.error("[Application insights]:", e?.message);
    return Errors.internal();
  }
}
