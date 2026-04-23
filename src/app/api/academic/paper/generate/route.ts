// src/app/api/academic/paper/generate/route.ts
// Canonical table: voice_chambers. `voice_profiles_chambers` was a legacy alias removed in Sprint A.
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
// VOICE DISCONNECTED — Mirror Mode ships standalone. Reconnect via API contract.
import { validatePaper } from "@/lib/academic/contentQualityGuard";
import { logEvent } from "@/lib/telemetry/logEvent";

export const runtime = "nodejs";

const MIN_VOICE_CONFIDENCE = 50;
const MIN_ACADEMIC_CHAMBER_CONFIDENCE = 30;

function getClaudeApiKey() {
  return process.env.CLAUDE_API_KEY || null;
}

function extractAnthropicText(content: unknown): string {
  if (!Array.isArray(content)) return "";
  for (const block of content) {
    if (
      block &&
      typeof block === "object" &&
      "type" in block &&
      (block as { type?: string }).type === "text" &&
      "text" in block &&
      typeof (block as { text?: unknown }).text === "string"
    ) {
      return (block as { text: string }).text;
    }
  }
  return "";
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
  const paperId = typeof body?.paperId === "string" ? body.paperId : null;
  const assignmentSetId =
    typeof body?.assignmentSetId === "string" ? body.assignmentSetId : null;
  const setOrder =
    body?.setOrder == null || Number.isNaN(Number(body.setOrder))
      ? null
      : Number(body.setOrder);
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

  const outlineStructure =
    outline.outline_structure && typeof outline.outline_structure === "object"
      ? (outline.outline_structure as {
          sections?: Array<{
            id?: string;
            title?: string;
            main_points?: string[];
            sources?: Array<{
              id?: string;
              title?: string;
              author?: string | null;
              publication?: string | null;
              year?: number | null;
              notes?: string | null;
              relevanceLevel?: "strong" | "partial" | "weak" | "unrelated" | null;
              relevanceExplanation?: string | null;
            }>;
          }>;
        })
      : null;
  const sourceRequirements =
    outline.source_requirements && typeof outline.source_requirements === "object"
      ? (outline.source_requirements as {
          sourcesRequired?: boolean;
          minimumCount?: number | null;
          sourceTypes?: string[];
          citationFormat?: string | null;
        })
      : null;
  const sections = Array.isArray(outlineStructure?.sections)
    ? outlineStructure.sections
    : [];
  const sectionConfidence =
    outline.section_confidence && typeof outline.section_confidence === "object"
      ? (outline.section_confidence as Record<string, "solid" | "somewhat_clear" | "unsure">)
      : {};
  const unsureSectionTitles = sections
    .filter((section) => {
      const sectionId = typeof section?.id === "string" ? section.id : "";
      return sectionId && sectionConfidence[sectionId] === "unsure";
    })
    .map((section) =>
      typeof section?.title === "string" && section.title.trim()
        ? section.title.trim()
        : "Untitled section"
    );
  const allSources = sections.flatMap((section) =>
    Array.isArray(section?.sources) ? section.sources : []
  );
  if (sourceRequirements?.sourcesRequired) {
    const minCount =
      typeof sourceRequirements.minimumCount === "number"
        ? sourceRequirements.minimumCount
        : null;
    if (typeof minCount === "number" && allSources.length < minCount) {
      return NextResponse.json(
        {
          success: false,
          error: `Source check failed. Required ${minCount} sources but found ${allSources.length}.`,
        },
        { status: 400 }
      );
    }

    const missingBySection = sections.some((section) => {
      const hasClaim =
        Array.isArray(section?.main_points) &&
        section.main_points.filter((point) => String(point || "").trim()).length > 0;
      const sources = Array.isArray(section?.sources) ? section.sources : [];
      return hasClaim && sources.length === 0;
    });
    if (missingBySection) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Source check failed. Every section with claims must have at least one source.",
        },
        { status: 400 }
      );
    }

    const unrelatedCount = allSources.filter(
      (source) => source?.relevanceLevel === "unrelated"
    ).length;
    if (unrelatedCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Source check failed. ${unrelatedCount} source(s) are marked unrelated.`,
        },
        { status: 400 }
      );
    }
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

  const voiceContext = {
    hasVoiceProfile: false,
    promptInjection: "",
    readiness: { isReady: false, tier: "none", score: 0, shouldWarn: false, lexMessage: "" },
    gatekeeper: { sufficientData: true, warnings: [] as string[], counts: null, thresholds: null },
  };
  const { data: academicChamber } = await supabase
    .from("voice_chambers")
    .select("aggregate_fingerprint, confidence_level")
    .eq("user_id", userId)
    .eq("chamber", "academic")
    .maybeSingle();

  const chamberConfidence = Number(academicChamber?.confidence_level || 0);
  const applyVoiceConstraints = chamberConfidence >= MIN_ACADEMIC_CHAMBER_CONFIDENCE;

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
  const voiceConstraintSection = applyVoiceConstraints
    ? `${voiceContext.promptInjection}

ACADEMIC VOICE FINGERPRINT:
${academicChamber?.aggregate_fingerprint || "Unavailable"}`
    : "No strict voice profile constraints for this generation pass.";
  const sourceContextSection = `
SOURCE REQUIREMENTS:
${JSON.stringify(sourceRequirements || {}, null, 2)}

SECTION SOURCES:
${JSON.stringify(
    sections.map((section) => ({
      id: section.id || null,
      title: section.title || null,
      main_points: section.main_points || [],
      sources: section.sources || [],
    })),
    null,
    2
  )}
`;

  const systemPrompt = `You are generating an academic paper in the student's authentic voice.

${voiceConstraintSection}

${sourceContextSection}

UNSURE SECTIONS TO TREAT WITH EXTRA INSTRUCTIONAL CARE:
${unsureSectionTitles.length > 0 ? unsureSectionTitles.join(", ") : "None flagged"}

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

  const content = extractAnthropicText(response.content);
  if (!content.trim()) {
    return NextResponse.json(
      { success: false, error: "Generation failed." },
      { status: 500 }
    );
  }

  const requirementCheck = validatePaper(content, resolvedRequirements);
  if (!requirementCheck.passed) {
    void logEvent({
      userId,
      eventType: "paper_requirements_failed",
      workspace: "paper_workflow",
      severity: "warn",
      payload: {
        outlineId,
        assignmentId,
        missing: requirementCheck.missing,
        score: requirementCheck.score,
      },
    });
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

  let persistedPaperId = paperId;
  if (paperId) {
    const { data: updatedPaper, error: updateError } = await supabase
      .from("academic_papers")
      .update({
        outline_id: outlineId,
        assignment_id: assignmentId,
        assignment_set_id: assignmentSetId,
        set_order: setOrder,
        topic: outline.topic,
        paper_content: content,
        citation_style: resolvedRequirements.citationStyle || null,
        citation_count: requirementCheck.citationCount,
        word_count: requirementCheck.wordCount,
        checkpoint_passed: false,
        emergency_skip_used: false,
        is_complete: false,
        workflow_step: "checkpoint",
        workflow_step_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", paperId)
      .eq("user_id", userId)
      .select("id")
      .single();
    if (updateError || !updatedPaper) {
      return NextResponse.json(
        { success: false, error: updateError?.message || "Save failed." },
        { status: 500 }
      );
    }
    persistedPaperId = String(updatedPaper.id);
  } else {
    const { data: insertedPaper, error: insertError } = await supabase
      .from("academic_papers")
      .insert({
        user_id: userId,
        outline_id: outlineId,
        assignment_id: assignmentId,
        assignment_set_id: assignmentSetId,
        set_order: setOrder,
        topic: outline.topic,
        paper_content: content,
        citation_style: resolvedRequirements.citationStyle || null,
        citation_count: requirementCheck.citationCount,
        word_count: requirementCheck.wordCount,
        checkpoint_passed: false,
        emergency_skip_used: false,
        is_complete: false,
      })
      .select("id")
      .single();

    if (insertError || !insertedPaper) {
      return NextResponse.json(
        { success: false, error: insertError?.message || "Save failed." },
        { status: 500 }
      );
    }
    persistedPaperId = String(insertedPaper.id);
  }

  // Mirror Mode: Do NOT learn from AI-generated output (spec compliant)

  return NextResponse.json(
    {
      success: true,
      paperId: persistedPaperId,
      content,
      wordCount: requirementCheck.wordCount,
      citationCount: requirementCheck.citationCount,
      travis_message: "Looks good. Victor, all set?",
      guardrails: {
        sufficientData: voiceContext.gatekeeper?.sufficientData ?? true,
        warnings: voiceContext.gatekeeper?.warnings || [],
        counts: voiceContext.gatekeeper?.counts || null,
        thresholds: voiceContext.gatekeeper?.thresholds || null,
      },
      voiceProfile: {
        applied: applyVoiceConstraints,
        confidence: chamberConfidence,
        minimumConfidence: MIN_ACADEMIC_CHAMBER_CONFIDENCE,
        warning:
          applyVoiceConstraints || chamberConfidence >= MIN_VOICE_CONFIDENCE
            ? null
            : "Add more academic writing samples in Mirror Mode to improve style matching.",
      },
    },
    { status: 200 }
  );
}
