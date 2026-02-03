// src/app/api/academic/paper/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { VoiceProfileService } from "@/services/voice-profile/VoiceProfileService";
import { learnFromTextDirect } from "@/lib/mirror-mode/liveLearning";

export const runtime = "nodejs";

const MIN_VOICE_CONFIDENCE = 50;

function getClaudeApiKey() {
  return process.env.CLAUDE_API_KEY || null;
}

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function countCitations(text: string) {
  const parenMatches = text.match(/\([^)]*\d{4}[^)]*\)/g) || [];
  const bracketMatches = text.match(/\[\d+\]/g) || [];
  return Math.max(parenMatches.length, bracketMatches.length);
}

function verifyRequirements(
  content: string,
  requirements: {
    wordCount?: number;
    minSources?: number;
    requiredSections?: string[];
  }
) {
  const missing: string[] = [];
  const wordCount = countWords(content);
  const citationCount = countCitations(content);

  if (requirements.wordCount && wordCount < requirements.wordCount) {
    missing.push(`Minimum word count: ${requirements.wordCount}`);
  }
  if (requirements.minSources && citationCount < requirements.minSources) {
    missing.push(`Minimum sources: ${requirements.minSources}`);
  }
  if (requirements.requiredSections?.length) {
    const lowerContent = content.toLowerCase();
    requirements.requiredSections.forEach((section) => {
      if (!lowerContent.includes(section.toLowerCase())) {
        missing.push(`Missing section: ${section}`);
      }
    });
  }

  return {
    passed: missing.length === 0,
    missing,
    wordCount,
    citationCount,
  };
}

export async function POST(request: NextRequest) {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const body = await request.json();
  const outlineId =
    typeof body?.outlineId === "string" ? body.outlineId : null;
  const requirements = body?.requirements || {};
  const assignmentId =
    typeof requirements?.assignmentId === "string"
      ? requirements.assignmentId
      : null;

  if (!outlineId) {
    return NextResponse.json(
      { success: false, error: "Outline ID is required." },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: outline, error: outlineError } = await supabase
    .from("academic_outlines")
    .select("*")
    .eq("id", outlineId)
    .eq("user_id", userId)
    .single();

  if (outlineError || !outline) {
    return NextResponse.json(
      { success: false, error: "Outline not found." },
      { status: 404 }
    );
  }

  let assignmentRequirements: {
    wordCount?: number;
    minSources?: number;
    citationStyle?: string;
    requiredSections?: string[];
  } = {};

  if (assignmentId) {
    const { data: assignment, error: assignmentError } = await supabase
      .from("assignments")
      .select("requirements")
      .eq("id", assignmentId)
      .eq("user_id", userId)
      .single();

    if (assignmentError || !assignment) {
      return NextResponse.json(
        { success: false, error: "Assignment not found." },
        { status: 404 }
      );
    }

    const req = assignment.requirements || {};
    assignmentRequirements = {
      wordCount: req.word_count,
      minSources: req.min_sources,
      citationStyle: req.citation_style,
      requiredSections: req.required_sections,
    };
  }

  const voiceContext = await VoiceProfileService.getGenerationContext(
    userId,
    "academic"
  );

  if (voiceContext.readiness.score < MIN_VOICE_CONFIDENCE) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Mirror Mode has not learned enough of your voice yet. Upload more writing samples to continue.",
        redirectTo: "/mirror-mode",
        confidence: voiceContext.readiness.score,
      },
      { status: 400 }
    );
  }

  const apiKey = getClaudeApiKey();
  if (!apiKey) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Missing API key. Add CLAUDE_API_KEY to .env.local and restart next dev.",
      },
      { status: 500 }
    );
  }

  const anthropic = new Anthropic({ apiKey });
  const resolvedRequirements = {
    wordCount: assignmentRequirements.wordCount ?? requirements.wordCount,
    minSources: assignmentRequirements.minSources ?? requirements.minSources,
    citationStyle:
      assignmentRequirements.citationStyle ?? requirements.citationStyle,
    requiredSections:
      assignmentRequirements.requiredSections ?? requirements.requiredSections,
  };

  const systemPrompt = `You are generating an academic paper in the student's authentic voice.

${voiceContext.promptInjection}

OUTLINE:
${JSON.stringify(outline.outline_structure, null, 2)}

ASSIGNMENT REQUIREMENTS:
- Length: ${resolvedRequirements.wordCount || "Not specified"} words
- Citation Style: ${resolvedRequirements.citationStyle || "Not specified"}
- Required Sections: ${(resolvedRequirements.requiredSections || []).join(", ") || "Not specified"}
- Minimum Sources: ${resolvedRequirements.minSources || "Not specified"}

CRITICAL INSTRUCTIONS:
1. Write in the student's authentic voice.
2. Follow the outline structure exactly.
3. Use proper academic formatting.
4. Meet all assignment requirements.
5. Do not fabricate sources or claims.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8000,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: "Generate the complete paper following the outline and requirements.",
      },
    ],
  });

  const content = response.content?.[0]?.text || "";
  if (!content.trim()) {
    return NextResponse.json(
      { success: false, error: "Generation failed." },
      { status: 500 }
    );
  }

  const requirementCheck = verifyRequirements(content, resolvedRequirements);
  if (!requirementCheck.passed) {
    return NextResponse.json(
      {
        success: false,
        error: "Paper does not meet all requirements.",
        missing: requirementCheck.missing,
        travis_message: "Hold up. You're missing something.",
      },
      { status: 400 }
    );
  }

  const { data: paper, error: insertError } = await supabase
    .from("academic_papers")
    .insert({
      user_id: userId,
      outline_id: outlineId,
      assignment_id: assignmentId,
      topic: outline.topic,
      paper_content: content,
      citation_style: resolvedRequirements.citationStyle || null,
      citation_count: requirementCheck.citationCount,
      word_count: requirementCheck.wordCount,
      checkpoint_passed: false,
      emergency_skip_used: false,
    })
    .select("id")
    .single();

  if (insertError || !paper) {
    return NextResponse.json(
      { success: false, error: insertError?.message || "Save failed." },
      { status: 500 }
    );
  }

  try {
    await learnFromTextDirect({
      userId,
      text: content,
      source: "other",
      metadata: {
        documentId: paper.id,
        title: outline.topic,
        context: "academic-paper",
      },
    });
  } catch (err) {
    console.log("Mirror Mode learning skipped:", err);
  }

  return NextResponse.json(
    {
      success: true,
      paperId: paper.id,
      content,
      wordCount: requirementCheck.wordCount,
      citationCount: requirementCheck.citationCount,
      travis_message: "Looks good. Victor, all set?",
    },
    { status: 200 }
  );
}
