// Career Assessment Generate Roadmap API Route
// src/app/api/career-assessment/generate-roadmap/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CareerRoadmap, AssessmentAnswers } from "@/types/career-assessment";
import { VoiceProfileService } from "@/services/voice-profile";

export async function POST(request: NextRequest) {
  let body: any = null; // ✅ available in catch

  try {
    body = await request.json();
    const { assessmentId, answers } = body;

    if (!assessmentId || !answers) {
      return NextResponse.json(
        { success: false, error: "assessmentId and answers are required" },
        { status: 400 }
      );
    }

    // ✅ FIX: await the async server client
    const supabase = await createSupabaseServerClient();

    // Get resume data if available
    const { data: assessmentData, error: readErr } = await supabase
      .from("career_assessments")
      .select("resume_snapshot, user_id")
      .eq("id", assessmentId)
      .single();

    if (readErr) {
      // still proceed with no resume snapshot
      console.warn("resume_snapshot fetch failed:", readErr.message);
    }

    const voiceContext = assessmentData?.user_id
      ? await VoiceProfileService.getGenerationContext(assessmentData.user_id, "career")
      : {
          hasVoiceProfile: false,
          readiness: {
            tier: "none",
            score: 0,
            isReady: false,
            canGenerate: true,
            shouldWarn: true,
            shouldEncourage: true,
            message: "No voice profile yet. Content will use standard AI tone.",
            lexMessage:
              "I don't know your writing style yet, so this will sound like generic AI. Want to set up Mirror Mode first so I can write like you?",
          },
          profile: null,
          promptInjection:
            "Write in a professional, polished tone suitable for career documents. Be clear, confident, and action-oriented. Note: No personalized voice profile is available, so this will use standard professional formatting.",
        };
    const systemPrompt = `You are Lex, a career advisor with deep HR expertise. You help users craft authentic, compelling career documents that showcase their real experience and value.

Your approach:
- Guide through conversation, don't auto-generate fabricated content
- Help users articulate their actual achievements powerfully
- Be direct but supportive, like a trusted mentor
- Focus on what makes this person uniquely valuable

${voiceContext.promptInjection}

${voiceContext.readiness.shouldWarn ? `Note: ${voiceContext.readiness.lexMessage}` : ''}`;

    // Build prompt for Claude
    const prompt = buildRoadmapPrompt(
      answers as AssessmentAnswers,
      assessmentData?.resume_snapshot
    );

    // Call Claude API
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.CLAUDE_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();

    // If Claude returned an error payload, fallback gracefully
    if (!response.ok) {
      console.error("Claude API error:", data);
      const fallbackRoadmap = generateFallbackRoadmap(
        (answers as AssessmentAnswers) || ({} as any)
      );
      return NextResponse.json({
        success: true,
        roadmap: fallbackRoadmap,
        voiceMetadata: {
          usedVoiceProfile: voiceContext.hasVoiceProfile && voiceContext.readiness.isReady,
          confidenceLevel: voiceContext.readiness.score,
          shouldAskFeedback: voiceContext.readiness.shouldWarn,
        },
      });
    }

    const responseText = data?.content?.[0]?.text || "";

    // Parse the roadmap
    const roadmap = parseRoadmapResponse(
      responseText,
      answers as AssessmentAnswers
    );

    // Save roadmap to database
    const { error: writeErr } = await supabase
      .from("career_assessments")
      .update({
        roadmap,
        status: "completed",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", assessmentId);

    if (writeErr) {
      console.error("Failed to save roadmap:", writeErr.message);
      // Still return roadmap to user even if save fails
    }

    return NextResponse.json({
      success: true,
      roadmap,
      voiceMetadata: {
        usedVoiceProfile: voiceContext.hasVoiceProfile && voiceContext.readiness.isReady,
        confidenceLevel: voiceContext.readiness.score,
        shouldAskFeedback: voiceContext.readiness.shouldWarn,
      },
    });
  } catch (error) {
    console.error("Generate roadmap error:", error);

    const fallbackRoadmap = generateFallbackRoadmap(
      (body?.answers || {}) as AssessmentAnswers
    );
    return NextResponse.json({ success: true, roadmap: fallbackRoadmap });
  }
}

function buildRoadmapPrompt(answers: AssessmentAnswers, resumeSnapshot: any): string {
  return `You are Lex, an expert career strategist and HR professional. Based on the following career assessment answers, create a detailed, personalized career roadmap.

## Assessment Answers:
${JSON.stringify(answers, null, 2)}

${resumeSnapshot ? `## Resume Summary:\n${JSON.stringify(resumeSnapshot, null, 2)}` : ""}

## Your Task:
Create a comprehensive career roadmap in JSON format. Include REAL certifications, courses, and resources with actual URLs.

Return ONLY valid JSON in this exact format:
{
  "executiveSummary": {
    "currentState": "Brief description of where they are now",
    "targetState": "Brief description of their goal",
    "timelineEstimate": "e.g., 6-12 months",
    "keyInsight": "One powerful insight about their situation"
  },
  "gapAnalysis": [
    {
      "category": "skill|experience|education|certification",
      "have": ["skills/experience they have"],
      "need": ["skills/experience they need"],
      "priority": "critical|important|nice_to_have"
    }
  ],
  "actionPlan": {
    "immediate": [
      {
        "id": "1",
        "title": "Action title",
        "description": "What to do and why",
        "category": "certification|education|skill|project|networking|application",
        "priority": "high|medium|low",
        "timeline": "this_week",
        "estimatedDuration": "e.g., 2 hours",
        "estimatedCost": "e.g., Free or $50",
        "resources": [
          {
            "name": "Resource name",
            "url": "https://actual-url.com",
            "type": "course|certification|book|website|tool",
            "provider": "Provider name",
            "cost": "Cost or Free"
          }
        ],
        "status": "pending"
      }
    ],
    "shortTerm": [],
    "mediumTerm": [],
    "longTerm": []
  },
  "jobTargets": [
    {
      "title": "Job title",
      "timeline": "now|6_months|2_years",
      "salaryRange": "$X - $Y",
      "requirements": ["Key requirements"],
      "matchScore": 75,
      "gapSummary": "What they need to bridge the gap"
    }
  ],
  "resumeRecommendations": {
    "emphasize": ["What to highlight"],
    "add": ["What to add"],
    "remove": ["What to remove or minimize"]
  },
  "certifications": [
    {
      "name": "Certification name",
      "provider": "Provider",
      "url": "https://actual-certification-url.com",
      "cost": "$X or Free",
      "duration": "X weeks/months",
      "priority": "critical|recommended|optional",
      "reason": "Why this certification helps"
    }
  ],
  "educationPaths": [
    {
      "type": "degree|bootcamp|online_course",
      "name": "Program name",
      "provider": "School/Platform",
      "url": "https://actual-url.com",
      "duration": "X months",
      "cost": "$X",
      "reason": "Why this helps their goals"
    }
  ],
  "lexInsights": [
    "HR insider tip 1",
    "HR insider tip 2",
    "HR insider tip 3"
  ]
}

IMPORTANT:
1. Use REAL URLs for certifications and courses (AWS, Google, Coursera, LinkedIn Learning, etc.)
2. Be specific and actionable - no vague advice
3. Prioritize based on their timeline urgency
4. Consider their willingness to invest in education
5. Match recommendations to their success definition
6. Include 3-5 actionable items per timeline category
7. Provide at least 2-3 relevant certifications with real URLs`;
}

function parseRoadmapResponse(responseText: string, answers: AssessmentAnswers): CareerRoadmap {
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed as CareerRoadmap;
    }
  } catch (e) {
    console.error("Failed to parse roadmap:", e);
  }

  return generateFallbackRoadmap(answers);
}

function generateFallbackRoadmap(answers: AssessmentAnswers): CareerRoadmap {
  const currentRole = (answers as any).current_role || "Professional";
  const targetGoal = (answers as any).short_term_goal || "Career advancement";

  return {
    executiveSummary: {
      currentState: `Currently working as ${currentRole}`,
      targetState: targetGoal,
      timelineEstimate: "6-12 months",
      keyInsight:
        "Focus on building demonstrable skills and expanding your professional network.",
    },
    gapAnalysis: [
      {
        category: "skill",
        have: ["Current role experience"],
        need: ["Target role requirements"],
        priority: "critical",
      },
    ],
    actionPlan: {
      immediate: [
        {
          id: "1",
          title: "Update your LinkedIn profile",
          description:
            "Optimize your profile with keywords from target job postings",
          category: "networking",
          priority: "high",
          timeline: "this_week",
          estimatedDuration: "2 hours",
          estimatedCost: "Free",
          resources: [
            {
              name: "LinkedIn Profile Optimization Guide",
              url: "https://www.linkedin.com/help/linkedin/answer/112133",
              type: "website",
              provider: "LinkedIn",
              cost: "Free",
            },
          ],
          status: "pending",
        },
      ],
      shortTerm: [
        {
          id: "2",
          title: "Research target companies",
          description:
            "Create a list of 10-15 companies where you would like to work",
          category: "application",
          priority: "high",
          timeline: "this_month",
          estimatedDuration: "4 hours",
          estimatedCost: "Free",
          resources: [
            {
              name: "Glassdoor Company Research",
              url: "https://www.glassdoor.com/Reviews/index.htm",
              type: "website",
              provider: "Glassdoor",
              cost: "Free",
            },
          ],
          status: "pending",
        },
      ],
      mediumTerm: [
        {
          id: "3",
          title: "Build a portfolio project",
          description:
            "Create a project that demonstrates skills relevant to your target role",
          category: "project",
          priority: "medium",
          timeline: "this_quarter",
          estimatedDuration: "20-40 hours",
          estimatedCost: "Free",
          resources: [
            {
              name: "GitHub",
              url: "https://github.com",
              type: "tool",
              provider: "GitHub",
              cost: "Free",
            },
          ],
          status: "pending",
        },
      ],
      longTerm: [
        {
          id: "4",
          title: "Obtain relevant certification",
          description:
            "Get certified in a skill that is highly valued in your target role",
          category: "certification",
          priority: "medium",
          timeline: "this_year",
          estimatedDuration: "2-3 months",
          estimatedCost: "Varies",
          resources: [
            {
              name: "Coursera Professional Certificates",
              url: "https://www.coursera.org/professional-certificates",
              type: "certification",
              provider: "Coursera",
              cost: "$39-49/month",
            },
          ],
          status: "pending",
        },
      ],
    },
    jobTargets: [
      {
        title: targetGoal,
        timeline: "6_months",
        salaryRange: "Market competitive",
        requirements: ["Relevant experience", "Industry knowledge"],
        matchScore: 65,
        gapSummary:
          "Focus on building specific skills and gaining relevant experience",
      },
    ],
    resumeRecommendations: {
      emphasize: [
        "Quantifiable achievements",
        "Relevant skills",
        "Leadership experience",
      ],
      add: ["Technical skills section", "Portfolio link"],
      remove: ["Outdated skills", "Irrelevant experience"],
    },
    certifications: [
      {
        name: "Google Career Certificates",
        provider: "Google/Coursera",
        url: "https://grow.google/certificates/",
        cost: "$39/month",
        duration: "3-6 months",
        priority: "recommended",
        reason:
          "Industry-recognized certificates that demonstrate practical skills",
      },
    ],
    educationPaths: [],
    lexInsights: [
      "Hiring managers spend an average of 7 seconds on initial resume review - make those seconds count with a strong summary.",
      "Networking still accounts for 70% of job placements. Reach out to 3 new connections this week.",
      "Tailoring your resume for each application can increase your callback rate by 40%.",
    ],
  };
}
