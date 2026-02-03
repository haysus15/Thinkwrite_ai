// Resume-Job Match API
// src/app/api/resume-job-match/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, createSupabaseAdmin } from "@/lib/auth/getAuthUser";
import { Errors } from "@/lib/api/errors";
import { calculateMatchScore } from "@/lib/resume-job-match-calculator";

export const runtime = "nodejs";

/**
 * Normalizes cached DB row -> API shape
 */
function shapeCachedMatchRow(row: any) {
  return {
    matchScore: row.match_score,
    skillsMatch: {
      score: row.skills_score,
      ...(row.skills_breakdown || {}),
    },
    experienceMatch: {
      score: row.experience_score,
      ...(row.experience_breakdown || {}),
    },
    educationMatch: {
      score: row.education_score,
      ...(row.education_breakdown || {}),
    },
    technologiesMatch: {
      score: row.technologies_score,
      ...(row.technologies_breakdown || {}),
    },
    gaps: row.gaps || [],
    strengths: row.strengths || [],
    recommendation: row.recommendation || "",
  };
}

// POST /api/resume-job-match - Calculate match between resume and job
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return Errors.unauthorized();
    }

    const supabase = createSupabaseAdmin();
    const { resumeId, jobAnalysisId } = await request.json();

    if (!resumeId || !jobAnalysisId) {
      return Errors.validationError("resumeId and jobAnalysisId are required");
    }

    // Check for existing cached match (LOCKED to user_id)
    const { data: existingMatch } = await supabase
      .from("resume_job_matches")
      .select("*")
      .eq("user_id", userId)
      .eq("resume_id", resumeId)
      .eq("job_analysis_id", jobAnalysisId)
      .maybeSingle();

    if (existingMatch) {
      console.log("✅ Found cached match score:", existingMatch.match_score);
      return NextResponse.json({
        success: true,
        match: shapeCachedMatchRow(existingMatch),
        cached: true,
      });
    }

    // Fetch resume data
    const { data: resume, error: resumeError } = await supabase
      .from("user_documents")
      .select("id, file_name, skills, experience, education, ats_score, extracted_text")
      .eq("id", resumeId)
      .eq("user_id", userId)
      .maybeSingle();

    if (resumeError || !resume) {
      console.error("Resume not found:", resumeError);
      return NextResponse.json(
        { success: false, error: "Resume not found" },
        { status: 404 }
      );
    }

    // Fetch job analysis data
    const { data: job, error: jobError } = await supabase
      .from("job_analyses")
      .select("id, job_title, company_name, ats_keywords, requirements")
      .eq("id", jobAnalysisId)
      .maybeSingle();

    if (jobError || !job) {
      console.error("Job analysis not found:", jobError);
      return NextResponse.json(
        { success: false, error: "Job analysis not found" },
        { status: 404 }
      );
    }

    // Prepare data for matching
    const resumeData = {
      skills: resume.skills || [],
      experience: resume.experience || [],
      education: resume.education || [],
      extractedText: resume.extracted_text || "",
    };

    const jobData =
      job.ats_keywords || {
        hardSkills: [],
        softSkills: [],
        technologies: [],
        educationRequirements: [],
        experienceKeywords: [],
        certifications: [],
      };

    // Calculate match (deterministic)
    const matchResult = calculateMatchScore(resumeData, jobData);

    console.log(`📊 Match calculated: ${matchResult.matchScore}/100`);

    // Store in database for caching
    const { error: insertError } = await supabase.from("resume_job_matches").insert({
      user_id: userId,
      resume_id: resumeId,
      job_analysis_id: jobAnalysisId,
      match_score: matchResult.matchScore,
      skills_score: matchResult.skillsMatch.score,
      experience_score: matchResult.experienceMatch.score,
      education_score: matchResult.educationMatch.score,
      technologies_score: matchResult.technologiesMatch.score,
      skills_breakdown: {
        matched: matchResult.skillsMatch.matched,
        missing: matchResult.skillsMatch.missing,
      },
      experience_breakdown: {
        resumeYears: matchResult.experienceMatch.resumeYears,
        requiredYears: matchResult.experienceMatch.requiredYears,
        relevantExperience: matchResult.experienceMatch.relevantExperience,
        missingExperience: matchResult.experienceMatch.missingExperience,
      },
      education_breakdown: {
        matched: matchResult.educationMatch.matched,
        resumeEducation: matchResult.educationMatch.resumeEducation,
        requiredEducation: matchResult.educationMatch.requiredEducation,
        details: matchResult.educationMatch.details,
      },
      technologies_breakdown: {
        matched: matchResult.technologiesMatch.matched,
        missing: matchResult.technologiesMatch.missing,
      },
      gaps: matchResult.gaps,
      strengths: matchResult.strengths,
      recommendation: matchResult.recommendation,
    });

    if (insertError) {
      console.error("Failed to cache match:", insertError);
      // Continue anyway - just won't be cached
    }

    return NextResponse.json({
      success: true,
      match: matchResult,
      cached: false,
      resumeName: resume.file_name,
      jobTitle: job.job_title,
      company: job.company_name,
    });
  } catch (error) {
    console.error("Match calculation error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Match calculation failed",
      },
      { status: 500 }
    );
  }
}

/**
 * GET behaviors:
 * 1) /api/resume-job-match?resumeId=X&jobAnalysisId=Y  -> get that one cached match
 * 2) /api/resume-job-match?limit=10                    -> dashboard list (top matches)
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return Errors.unauthorized();
    }

    const supabase = createSupabaseAdmin();
    const { searchParams } = new URL(request.url);

    const resumeId = searchParams.get("resumeId");
    const jobAnalysisId = searchParams.get("jobAnalysisId");
    const limit = Math.max(1, Math.min(50, Number(searchParams.get("limit") || 8)));

    // Case A: specific cached match
    if (resumeId && jobAnalysisId) {
      const { data: match, error } = await supabase
        .from("resume_job_matches")
        .select("*")
        .eq("user_id", userId)
        .eq("resume_id", resumeId)
        .eq("job_analysis_id", jobAnalysisId)
        .maybeSingle();

      if (error || !match) {
        return NextResponse.json({
          success: false,
          exists: false,
          error: "No match found - calculate first",
        });
      }

      return NextResponse.json({
        success: true,
        exists: true,
        match: shapeCachedMatchRow(match),
      });
    }

    // Case B: dashboard list (top matches for user)
    const { data: rows, error: listErr } = await supabase
      .from("resume_job_matches")
      .select(
        [
          "id",
          "user_id",
          "resume_id",
          "job_analysis_id",
          "match_score",
          "created_at",
          "updated_at",
        ].join(",")
      )
      .eq("user_id", userId)
      .order("match_score", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (listErr) {
      return NextResponse.json(
        { success: false, error: listErr.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      mode: "list",
      matches: rows ?? [],
    });
  } catch (error) {
    console.error("Get match error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get match",
      },
      { status: 500 }
    );
  }
}

// DELETE /api/resume-job-match - Clear cached match (to recalculate)
export async function DELETE(request: NextRequest) {
  try {
    // Authenticate user
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return Errors.unauthorized();
    }

    const supabase = createSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const resumeId = searchParams.get("resumeId");
    const jobAnalysisId = searchParams.get("jobAnalysisId");

    if (!resumeId || !jobAnalysisId) {
      return Errors.validationError("resumeId and jobAnalysisId are required");
    }

    const { error } = await supabase
      .from("resume_job_matches")
      .delete()
      .eq("user_id", userId)
      .eq("resume_id", resumeId)
      .eq("job_analysis_id", jobAnalysisId);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Match cache cleared",
    });
  } catch (error) {
    console.error("Delete match error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete match",
      },
      { status: 500 }
    );
  }
}
