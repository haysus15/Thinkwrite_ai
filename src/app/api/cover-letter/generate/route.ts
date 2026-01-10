// ============================================================
// THINKWRITE AI - COVER LETTER GENERATION API
// Path: src/app/api/cover-letter/generate/route.ts
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthUser, createSupabaseAdmin } from "@/lib/auth/getAuthUser";
import { Errors } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rateLimiter";
import { learnFromTextDirect } from "@/lib/mirror-mode/liveLearning";
import { getVoiceForGeneration, type VoiceInjectionResult } from "@/lib/mirror-mode/voiceInjection";

export const runtime = "nodejs";

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------
function getClaudeApiKey() {
  // You said you're using CLAUDE_API_KEY — we support it first.
  return process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY || null;
}

function getAnthropicClient() {
  const apiKey = getClaudeApiKey();
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

// ============================================================
// TYPES
// ============================================================

interface GenerateRequest {
  userId: string;
  resumeId?: string;
  jobAnalysisId?: string;

  companyName?: string;
  jobTitle?: string;
  jobDescription?: string;
  recipientName?: string;
  recipientTitle?: string;

  toneSetting?: "formal" | "professional" | "conversational" | "creative";
  lengthSetting?: "concise" | "standard" | "detailed";
  energyLevel?: "humble" | "balanced" | "confident" | "assertive";

  focusAreas?: Array<{
    type: "achievement" | "skill" | "strength" | "gap" | "keyword";
    description: string;
    relevanceScore?: number;
    framing?: string;
  }>;

  templateId?: string;

  regenerateSection?: "opening" | "body" | "closing";
  existingContent?: string;
}

interface ResumeRow {
  id: string;
  user_id: string;
  file_name: string;
  extracted_text?: string | null;
  analysis_summary?: any;
  ats_score?: number | null;
  created_at: string;
  is_active?: boolean;
}

interface JobAnalysisData {
  id: string;
  job_title: string;
  company_name: string;
  location?: string | null;
  job_description?: string | null;
  requirements?: string[] | null;
  responsibilities?: string[] | null;
  hidden_insights?: any;
  industry_intelligence?: any;
  ats_keywords?: any;
}

type MatchRow = any;

// ============================================================
// MAIN GENERATION ENDPOINT
// ============================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Authenticate user
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return Errors.unauthorized();
    }

    // Rate limiting
    const { limited, remaining, resetIn } = checkRateLimit(userId, 'cover-letter-generate');
    if (limited) {
      return Errors.rateLimited(Math.ceil(resetIn / 1000));
    }

    const supabase = createSupabaseAdmin();
    const body: GenerateRequest = await request.json();

    // --------------------------------------------------------
    // 0) Validate Anthropic (don't crash if missing)
    // --------------------------------------------------------
    const anthropic = getAnthropicClient();
    if (!anthropic) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Missing API key. Add CLAUDE_API_KEY (or ANTHROPIC_API_KEY) to .env.local and restart next dev.",
        },
        { status: 500 }
      );
    }

    // --------------------------------------------------------
    // 1) Gather context
    // --------------------------------------------------------

    // 1A) Resume (ALIGN WITH /api/resumes => user_documents)
    let resumeData: ResumeRow | null = null;

    if (body.resumeId) {
      const { data, error } = await supabase
        .from("user_documents")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true)
        .eq("id", body.resumeId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) {
        console.warn("⚠️ [cover-letter:POST] resume fetch error:", error);
      } else if (data && data.length > 0) {
        resumeData = data[0] as ResumeRow;
      } else {
        console.warn("⚠️ [cover-letter:POST] resume not found:", body.resumeId);
      }
    }

    // 1B) Job analysis
    let jobData: JobAnalysisData | null = null;

    if (body.jobAnalysisId) {
      const { data, error } = await supabase
        .from("job_analyses")
        .select("*")
        .eq("id", body.jobAnalysisId)
        .eq("user_id", userId)
        .limit(1);

      if (!error && data && data.length > 0) {
        jobData = data[0] as JobAnalysisData;
      }
    }

    // 1C) Match (optional)
    let matchData: MatchRow | null = null;
    if (body.resumeId && body.jobAnalysisId) {
      const { data, error } = await supabase
        .from("resume_job_matches")
        .select("*")
        .eq("resume_id", body.resumeId)
        .eq("job_analysis_id", body.jobAnalysisId)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) {
        console.log("ℹ️ [cover-letter:POST] no match found (ok):", error.message);
      } else if (data && data.length > 0) {
        matchData = data[0];
      }
    }

    // 1D) Template (optional)
    let templateData: any = null;
    if (body.templateId) {
      const { data } = await supabase
        .from("cover_letter_templates")
        .select("*")
        .eq("id", body.templateId)
        .limit(1);

      if (data && data.length > 0) {
        templateData = data[0];
        // increment usage (best-effort)
        await supabase
          .from("cover_letter_templates")
          .update({ usage_count: (templateData.usage_count || 0) + 1 })
          .eq("id", body.templateId);
      }
    }

    // --------------------------------------------------------
    // 2) Fetch voice profile for personalized generation
    // --------------------------------------------------------
    let voiceContext: VoiceInjectionResult | null = null;
    try {
      voiceContext = await getVoiceForGeneration(userId, { minConfidence: 25 });
      if (voiceContext.hasVoice) {
        console.log(`🔮 Voice profile active: ${voiceContext.confidenceLabel} (${voiceContext.confidenceLevel}%)`);
      }
    } catch (e) {
      console.log('Voice profile fetch skipped:', e);
      // Continue without voice - don't break main feature
    }

    // --------------------------------------------------------
    // 3) Build prompt
    // --------------------------------------------------------
    const companyName = jobData?.company_name || body.companyName || "the company";
    const jobTitle = jobData?.job_title || body.jobTitle || "the position";
    const recipientName = body.recipientName || "Hiring Manager";

    const prompt = buildGenerationPrompt({
      resumeData,
      jobData,
      matchData,
      templateData,
      settings: {
        tone: body.toneSetting || "professional",
        length: body.lengthSetting || "standard",
        energy: body.energyLevel || "confident",
      },
      focusAreas: body.focusAreas,
      companyName,
      jobTitle,
      jobDescription: body.jobDescription,
      recipientName,
      recipientTitle: body.recipientTitle,
      regenerateSection: body.regenerateSection,
      existingContent: body.existingContent,
      voiceContext,
    });

    // --------------------------------------------------------
    // 3) Generate with Claude (NO lost context)
    // --------------------------------------------------------
    const clientAny = anthropic as any;

    // Prefer stable API if present
    if (clientAny?.messages?.create) {
      const response = await clientAny.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      });

      return await finishAndRespond({
        response,
        body,
        userId,
        resumeData,
        jobData,
        matchData,
        companyName,
        jobTitle,
        recipientName,
        startTime,
      });
    }

    // Fallback to beta if that's what this SDK exposes
    if (clientAny?.beta?.messages?.create) {
      const response = await clientAny.beta.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      });

      return await finishAndRespond({
        response,
        body,
        userId,
        resumeData,
        jobData,
        matchData,
        companyName,
        jobTitle,
        recipientName,
        startTime,
      });
    }

    // If neither exists, the installed SDK is incompatible
    return NextResponse.json(
      {
        success: false,
        error:
          "Anthropic SDK mismatch: messages.create not available. Update @anthropic-ai/sdk to a recent version.",
      },
      { status: 500 }
    );
  } catch (error) {
    console.error("❌ [cover-letter:POST] generation error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Generation failed",
      },
      { status: 500 }
    );
  }
}

// ============================================================
// GET ENDPOINT - Retrieve cover letters (unchanged behavior)
// ============================================================

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return Errors.unauthorized();
    }

    const supabase = createSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const coverLetterId = searchParams.get("id");
    const jobAnalysisId = searchParams.get("jobAnalysisId");

    // Get single cover letter by ID
    if (coverLetterId) {
      const { data, error } = await supabase
        .from("cover_letters")
        .select("*")
        .eq("id", coverLetterId)
        .eq("user_id", userId)
        .single();

      if (error || !data) {
        return NextResponse.json({ 
          success: false, 
          error: "Cover letter not found" 
        }, { status: 404 });
      }

      return NextResponse.json({ success: true, coverLetter: data });
    }

    // Get cover letters for specific job
    if (jobAnalysisId) {
      const { data, error } = await supabase
        .from("cover_letters")
        .select("*")
        .eq("job_analysis_id", jobAnalysisId)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("❌ Error fetching cover letters by job:", error);
        return NextResponse.json({ 
          success: false, 
          error: "Failed to fetch cover letters" 
        }, { status: 500 });
      }

      return NextResponse.json({ 
        success: true, 
        coverLetters: data || [] 
      });
    }

    // Get all cover letters for user (FIXED - query cover_letters directly)
    const { data, error } = await supabase
      .from("cover_letters")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("❌ Error fetching cover letters:", error);
      return NextResponse.json({ 
        success: false, 
        error: "Failed to fetch cover letters" 
      }, { status: 500 });
    }

    console.log(`✅ [cover-letter:GET] Found ${data?.length || 0} cover letters`);

    return NextResponse.json({
      success: true,
      coverLetters: data || [],
      stats: null, // No stats table, can be added later
    });

  } catch (error) {
    console.error("❌ Error in GET cover letters:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      },
      { status: 500 }
    );
  }
}

// ============================================================
// DELETE ENDPOINT - Delete a cover letter
// ============================================================

export async function DELETE(request: NextRequest) {
  try {
    // Authenticate user
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return Errors.unauthorized();
    }

    const supabase = createSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const coverLetterId = searchParams.get("id");

    if (!coverLetterId) {
      return Errors.missingField("id");
    }

    // Delete the cover letter (user can only delete their own)
    const { error } = await supabase
      .from("cover_letters")
      .delete()
      .eq("id", coverLetterId)
      .eq("user_id", userId);

    if (error) {
      console.error("❌ [cover-letter:DELETE] error:", error);
      return NextResponse.json(
        { success: false, error: "Failed to delete cover letter" },
        { status: 500 }
      );
    }

    console.log("✅ [cover-letter:DELETE] deleted:", coverLetterId);

    return NextResponse.json({ 
      success: true,
      message: "Cover letter deleted successfully" 
    });
    
  } catch (error) {
    console.error("❌ [cover-letter:DELETE] error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      },
      { status: 500 }
    );
  }
}

// ============================================================
// FINALIZE: PARSE + SCORE + SAVE + RESPOND
// ============================================================

async function finishAndRespond(args: {
  response: any;
  body: GenerateRequest;
  userId: string;
  resumeData: ResumeRow | null;
  jobData: JobAnalysisData | null;
  matchData: any;
  companyName: string;
  jobTitle: string;
  recipientName: string;
  startTime: number;
}) {
  const { response, body, userId, jobData, matchData, companyName, jobTitle, recipientName, startTime } = args;
  const supabase = createSupabaseAdmin();

  const generatedContent =
    response?.content?.[0]?.type === "text" ? response.content[0].text : "";

  const parsedContent = parseGeneratedContent(generatedContent);

  const scores = calculateScores({
    content: parsedContent.fullText,
    jobData,
    matchData,
  });

  // Save (best-effort)
  const insertPayload: any = {
    user_id: userId,
    resume_id: body.resumeId || null,
    job_analysis_id: body.jobAnalysisId || null,
    company_name: companyName,
    job_title: jobTitle,
    recipient_name: recipientName,
    recipient_title: body.recipientTitle || null,
    content: parsedContent.fullText,
    content_html: parsedContent.html,
    content_sections: parsedContent.sections,
    tone_setting: body.toneSetting || "professional",
    length_setting: body.lengthSetting || "standard",
    energy_level: body.energyLevel || "confident",
    focus_areas: body.focusAreas || [],
    voice_match_score: scores.voiceMatch,
    job_alignment_score: scores.jobAlignment,
    overall_quality_score: scores.overall,
    status: "complete",
    generation_model: "claude-sonnet-4-20250514",
    generation_duration_ms: Date.now() - startTime,
  };

  const { data: savedCoverLetter, error: saveError } = await supabase
    .from("cover_letters")
    .insert(insertPayload)
    .select()
    .single();

  if (saveError) {
    console.warn("⚠️ [cover-letter:POST] save failed (returning anyway):", saveError);
  }

  // generation log (best-effort)
  try {
    await supabase.from("cover_letter_generation_log").insert({
      cover_letter_id: savedCoverLetter?.id || null,
      user_id: userId,
      generation_type: body.regenerateSection || "full",
      input_context: {
        hasResume: !!args.resumeData,
        hasJobAnalysis: !!jobData,
        hasMatch: !!matchData,
        settings: {
          tone: body.toneSetting,
          length: body.lengthSetting,
          energy: body.energyLevel,
        },
      },
      output_scores: scores,
      generation_duration_ms: Date.now() - startTime,
      token_count: response?.usage?.output_tokens,
    });
  } catch (e) {
    console.warn("⚠️ [cover-letter:POST] log insert failed:", e);
  }

  // Mirror Mode: Live voice learning from generated cover letter
  try {
    await learnFromTextDirect({
      userId: userId,
      text: parsedContent.fullText,
      source: 'cover-letter',
      metadata: {
        documentId: savedCoverLetter?.id,
        title: `Cover letter for ${companyName} - ${jobTitle}`,
        context: `tone:${body.toneSetting || 'professional'}, energy:${body.energyLevel || 'confident'}`,
      },
    });
  } catch (e) {
    // Silent fail - learning shouldn't break cover letter generation
    console.log("Mirror Mode learning skipped:", e);
  }

  return NextResponse.json({
    success: true,
    coverLetter: {
      id: savedCoverLetter?.id,
      content: parsedContent.fullText,
      contentHtml: parsedContent.html,
      sections: parsedContent.sections,
      scores,
      metadata: {
        companyName,
        jobTitle,
        recipientName,
        generatedAt: new Date().toISOString(),
        generationTimeMs: Date.now() - startTime,
      },
    },
  });
}

// ============================================================
// PROMPT / PARSING / SCORING (same logic)
// ============================================================

function buildGenerationPrompt(params: {
  resumeData: ResumeRow | null;
  jobData: JobAnalysisData | null;
  matchData: any;
  templateData: any;
  settings: { tone: string; length: string; energy: string };
  focusAreas?: any[];
  companyName: string;
  jobTitle: string;
  jobDescription?: string;
  recipientName: string;
  recipientTitle?: string;
  regenerateSection?: string;
  existingContent?: string;
  voiceContext?: VoiceInjectionResult | null;
}): string {
  const {
    resumeData,
    jobData,
    matchData,
    templateData,
    settings,
    focusAreas,
    companyName,
    jobTitle,
    jobDescription,
    recipientName,
    recipientTitle,
    regenerateSection,
    existingContent,
    voiceContext,
  } = params;

  const toneGuide: Record<string, string> = {
    formal:
      "Use formal, traditional business language. Avoid contractions. Maintain professional distance.",
    professional:
      "Use clear, professional language. Some warmth is okay. Standard business tone.",
    conversational:
      "Use friendly, approachable language. Contractions are fine. Show personality while staying professional.",
    creative:
      "Use engaging, distinctive language. Show creativity and personality. Stand out from typical cover letters.",
  };

  const lengthGuide: Record<string, string> = {
    concise: "200-250 words. Get to the point quickly. One page maximum.",
    standard: "300-350 words. Balanced coverage. Standard one-page format.",
    detailed: "400-450 words. More context and examples. Still one page but denser.",
  };

  const energyGuide: Record<string, string> = {
    humble:
      "Emphasize learning and growth. Acknowledge what you hope to gain. Respectful tone.",
    balanced: "Confident but not boastful. Let achievements speak for themselves.",
    confident: "Strong, assertive statements. Clear value proposition. Direct about capabilities.",
    assertive: "Bold claims backed by evidence. Leadership-oriented language. Strong closing.",
  };

  let prompt = `You are Lex, the HR & recruiting brain inside the ThinkWrite Career Studio.

You ALWAYS:
- Read the decoded job analysis first when available (requirements, responsibilities, hidden insights).
- Read the candidate's resume analysis and extracted content.
- Use match analysis (strengths/gaps) to decide what to spotlight.
- Write a cover letter that explicitly connects achievements to the job's real needs.
- Sound professional and human, not AI, not generic.

## GENERATION SETTINGS
**Tone:** ${settings.tone}
${toneGuide[settings.tone]}

**Length:** ${settings.length}
${lengthGuide[settings.length]}

**Energy Level:** ${settings.energy}
${energyGuide[settings.energy]}
${voiceContext?.hasVoice ? `
## USER'S AUTHENTIC VOICE
${voiceContext.promptSection}

**Important:** While applying the user's voice characteristics, still respect the tone/energy settings above. The user's voice should inform HOW you write (sentence structure, vocabulary patterns), while the tone setting determines the overall formality level.
` : ''}
## TARGET POSITION
**Company:** ${companyName}
**Position:** ${jobTitle}
**Recipient:** ${recipientName}${recipientTitle ? ` (${recipientTitle})` : ""}
`;

  if (jobData) {
    prompt += `
## JOB DETAILS (DECODED FROM JOB ANALYSIS)
**Description:**
${jobData.job_description || "Not provided"}

**Key Requirements:**
${jobData.requirements?.map((r) => `- ${r}`).join("\n") || "Not specified"}

**Responsibilities:**
${jobData.responsibilities?.map((r) => `- ${r}`).join("\n") || "Not specified"}
`;

    if (jobData.hidden_insights) {
      prompt += `
**Company Culture & Hidden Insights:**
${JSON.stringify(jobData.hidden_insights, null, 2)}
`;
    }

    if (jobData.industry_intelligence) {
      prompt += `
**Industry / Role Intelligence:**
${JSON.stringify(jobData.industry_intelligence, null, 2)}
`;
    }
  } else if (jobDescription) {
    prompt += `
## JOB DETAILS (RAW DESCRIPTION)
${jobDescription}
`;
  }

  if (resumeData) {
    const analysis = resumeData.analysis_summary;

    prompt += `
## CANDIDATE BACKGROUND
**Resume:** ${resumeData.file_name}
`;

    if (analysis) {
      const parsed = typeof analysis === "string" ? safeParseJson(analysis) : analysis;

      if (parsed?.professionalSummary) {
        prompt += `\n**Professional Summary:**\n${parsed.professionalSummary}\n`;
      }
      if (parsed?.experience) {
        prompt += `\n**Key Experience:**\n${JSON.stringify(parsed.experience, null, 2)}\n`;
      }
      if (parsed?.skills) {
        prompt += `\n**Skills:**\n${
          Array.isArray(parsed.skills) ? parsed.skills.join(", ") : JSON.stringify(parsed.skills)
        }\n`;
      }
    }

    if (resumeData.extracted_text) {
      prompt += `\n**Resume Content (truncated):**\n${resumeData.extracted_text.substring(0, 3000)}\n`;
    }
  }

  if (matchData) {
    prompt += `
## MATCH ANALYSIS
**Overall Match Score:** ${matchData.match_score || matchData.overall_match_score || "N/A"}%

**Strengths to Highlight:**
${
  matchData.strengths?.map((s: any) => `- ${typeof s === "string" ? s : s.description}`).join("\n") ||
  "Not analyzed"
}

**Gaps to Address:**
${
  matchData.gaps?.map((g: any) => `- ${typeof g === "string" ? g : g.description}`).join("\n") ||
  "None identified"
}

## ALIGNMENT STRATEGY
- Lean heavily on strengths.
- If there are gaps, briefly reframe them as adjacent experience, learning speed, or growth.
`;
  }

  if (focusAreas && focusAreas.length > 0) {
    prompt += `
## ACHIEVEMENTS TO EMPHASIZE
${focusAreas
  .map(
    (f, i) =>
      `${i + 1}. ${f.description}${f.relevanceScore ? ` (Relevance: ${f.relevanceScore}%)` : ""}${
        f.framing ? `\n   Framing: ${f.framing}` : ""
      }`
  )
  .join("\n")}
`;
  }

  if (templateData) {
    prompt += `
## TEMPLATE GUIDANCE
**Opening Style:**
${templateData.opening_template}

**Body Style:**
${templateData.body_template}

**Closing Style:**
${templateData.closing_template}
`;
  }

  if (regenerateSection && existingContent) {
    prompt += `
## REGENERATION REQUEST
Rewrite the FULL cover letter, but focus most on improving the **${regenerateSection}** section.

**Current Full Letter:**
${existingContent}
`;
  }

  prompt += `
## OUTPUT FORMAT
---OPENING---
[Opening paragraph]

---BODY---
[Body paragraphs]

---CLOSING---
[Closing paragraph]

---END---

## CRITICAL GUIDELINES
- Sound human. Avoid clichés like "excited to apply".
- Be specific (job + candidate).
- Strong hook in the first sentence.
- Confident close with a clear call-to-action.
`;

  return prompt;
}

function safeParseJson(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function parseGeneratedContent(content: string): {
  fullText: string;
  html: string;
  sections: {
    opening: { content: string; version: number };
    body: { content: string; version: number }[];
    closing: { content: string; version: number };
  };
} {
  const openingMatch = content.match(/---OPENING---\s*([\s\S]*?)\s*---BODY---/);
  const bodyMatch = content.match(/---BODY---\s*([\s\S]*?)\s*---CLOSING---/);
  const closingMatch = content.match(/---CLOSING---\s*([\s\S]*?)\s*---END---/);

  const opening = openingMatch?.[1]?.trim() || "";
  const body = bodyMatch?.[1]?.trim() || "";
  const closing = closingMatch?.[1]?.trim() || "";

  const fullText =
    opening && body && closing
      ? `${opening}\n\n${body}\n\n${closing}`
      : content.replace(/---\w+---/g, "").trim();

  const bodyParagraphs = body ? body.split(/\n\n+/).filter((p) => p.trim()) : [fullText];

  const html = `<div class="cover-letter">
  <div class="opening">${escapeHtml(opening || bodyParagraphs[0] || "")}</div>
  ${bodyParagraphs
    .slice(opening ? 0 : 1)
    .map((p) => `<div class="body-paragraph">${escapeHtml(p)}</div>`)
    .join("\n  ")}
  <div class="closing">${escapeHtml(closing || "")}</div>
</div>`;

  return {
    fullText,
    html,
    sections: {
      opening: { content: opening || bodyParagraphs[0] || "", version: 1 },
      body: bodyParagraphs.map((p) => ({ content: p, version: 1 })),
      closing: { content: closing || "", version: 1 },
    },
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/\n/g, "<br>");
}

function calculateScores(params: {
  content: string;
  jobData: JobAnalysisData | null;
  matchData: any;
}): { voiceMatch: number; jobAlignment: number; overall: number } {
  const { content, jobData, matchData } = params;

  let jobAlignment = 70;
  let voiceMatch = 75;

  if (jobData?.requirements) {
    const contentLower = content.toLowerCase();
    const mentioned = jobData.requirements.filter((req) =>
      contentLower.includes(req.toLowerCase().split(" ")[0])
    );
    jobAlignment += Math.min(20, mentioned.length * 5);
  }

  if (matchData?.match_score) {
    jobAlignment = Math.round((jobAlignment + matchData.match_score) / 2);
  }

  const goodPractices = [
    !content.toLowerCase().includes("i am excited to apply"),
    !content.toLowerCase().includes("i believe i would be"),
    jobData?.company_name ? content.includes(jobData.company_name) : true,
    content.length > 200 && content.length < 650,
  ];

  voiceMatch += goodPractices.filter(Boolean).length * 3;

  voiceMatch = Math.min(100, voiceMatch);
  jobAlignment = Math.min(100, jobAlignment);

  const overall = Math.round(voiceMatch * 0.4 + jobAlignment * 0.6);
  return { voiceMatch, jobAlignment, overall };
}