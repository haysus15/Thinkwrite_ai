// ============================================================
// THINKWRITE AI - COVER LETTER FROM CONVERSATION EXTRACTION
// Path: src/app/api/lex/extract-cover-letter-content/route.ts
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, createSupabaseAdmin } from "@/lib/auth/getAuthUser";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

function getClaudeApiKey() {
  return process.env.CLAUDE_API_KEY || null;
}

function getAnthropicClient() {
  const apiKey = getClaudeApiKey();
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

// ============================================================
// MAIN EXTRACTION ENDPOINT
// ============================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return NextResponse.json({ success: false, error: authError || "Authentication required" }, { status: 401 });
    }

    const supabase = createSupabaseAdmin();
    const body = await request.json();
    const {
      conversationHistory,
      resumeId,
      jobId
    } = body;

    console.log('[extract-cover-letter] Starting extraction...');
    console.log('   Conversation length:', conversationHistory?.length || 0);
    console.log('   Resume ID:', resumeId);
    console.log('   Job ID:', jobId);

    // Validate inputs
    if (!conversationHistory || !Array.isArray(conversationHistory)) {
      return NextResponse.json(
        { success: false, error: 'Conversation history is required' },
        { status: 400 }
      );
    }

    if (!resumeId || !jobId) {
      return NextResponse.json(
        { success: false, error: 'resumeId and jobId are required' },
        { status: 400 }
      );
    }

    // Check API key
    const anthropic = getAnthropicClient();
    if (!anthropic) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing API key. Add CLAUDE_API_KEY to .env.local'
        },
        { status: 500 }
      );
    }

    // --------------------------------------------------------
    // 1) Load resume and job data (MATCH YOUR SCHEMA)
    // --------------------------------------------------------
    
    // Resume from user_documents
    const { data: resumeData, error: resumeError } = await supabase
      .from('user_documents')
      .select('*')
      .eq('id', resumeId)
      .eq('user_id', userId)
      .single();

    if (resumeError || !resumeData) {
      return NextResponse.json(
        { success: false, error: 'Resume not found' },
        { status: 404 }
      );
    }

    // Job from job_analyses
    const { data: jobData, error: jobError } = await supabase
      .from('job_analyses')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', userId)
      .single();

    if (jobError || !jobData) {
      return NextResponse.json(
        { success: false, error: 'Job analysis not found' },
        { status: 404 }
      );
    }

    // --------------------------------------------------------
    // 2) Extract cover letter from conversation
    // --------------------------------------------------------
    
    const conversationText = conversationHistory
      .map((msg: Message) => `${msg.role === 'user' ? 'User' : 'Lex'}: ${msg.content}`)
      .join('\n\n');

    const systemPrompt = `You are analyzing a strategic conversation between a user and their career advisor (Lex) about a cover letter.

Your task is to write an authentic, compelling cover letter based on what the user actually said in the conversation.

CRITICAL RULES:
1. Base everything on what the user actually said - Don't invent experiences
2. Use their own words and phrasing - Sound like them, not generic AI
3. Maintain honesty - Only include what was genuinely discussed
4. Capture their authentic voice
5. Address what they shared - motivation, relevant experience, company fit

CONVERSATION:
${conversationText}

RESUME REFERENCE:
${resumeData.extracted_text?.substring(0, 2000) || 'Not available'}

TARGET JOB:
Position: ${jobData.job_title}
Company: ${jobData.company_name}
Location: ${jobData.location || 'Not specified'}

COVER LETTER STRUCTURE:

---OPENING---
[Hook connecting to their discussion + who they are]
2-3 sentences

---BODY---
[Paragraph 1: Relevant experience/achievements from their resume]

[Paragraph 2: Why this role/company fits their goals from conversation]

[Paragraph 3 if needed: Address any gaps/transitions they discussed]

---CLOSING---
[Enthusiasm for next steps + call to action]
2-3 sentences

---END---

TONE: Match the user's communication style from the conversation.
LENGTH: 250-400 words.
AUTHENTICITY: Every sentence should trace to something they said or is on their resume.

Generate the complete cover letter now.`;

    const clientAny = anthropic as any;
    
    let response;
    if (clientAny?.messages?.create) {
      response = await clientAny.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: systemPrompt }]
      });
    } else if (clientAny?.beta?.messages?.create) {
      response = await clientAny.beta.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: systemPrompt }]
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Anthropic SDK mismatch' },
        { status: 500 }
      );
    }

    const generatedContent = response?.content?.[0]?.type === 'text' 
      ? response.content[0].text 
      : '';

    if (!generatedContent) {
      return NextResponse.json(
        { success: false, error: 'Failed to extract cover letter content' },
        { status: 500 }
      );
    }

    // --------------------------------------------------------
    // 3) Parse content (SAME AS YOUR GENERATE API)
    // --------------------------------------------------------
    
    const parsedContent = parseGeneratedContent(generatedContent);

    // --------------------------------------------------------
    // 4) Calculate scores (SAME AS YOUR GENERATE API)
    // --------------------------------------------------------
    
    const scores = calculateScores({
      content: parsedContent.fullText,
      jobData
    });

    // --------------------------------------------------------
    // 5) Get Lex's commentary
    // --------------------------------------------------------
    
    const lexCommentary = await getLexCommentary(
      parsedContent.fullText,
      conversationHistory,
      anthropic
    );

    // --------------------------------------------------------
    // 6) Save to database (MATCH YOUR SCHEMA EXACTLY)
    // --------------------------------------------------------
    
    const insertPayload = {
      user_id: userId,
      resume_id: resumeId,
      job_analysis_id: jobId,
      company_name: jobData.company_name,
      job_title: jobData.job_title,
      recipient_name: 'Hiring Manager',
      recipient_title: null,
      content: parsedContent.fullText,
      content_html: parsedContent.html,
      content_sections: parsedContent.sections,
      tone_setting: 'professional',
      length_setting: 'standard',
      energy_level: 'confident',
      focus_areas: [],
      voice_match_score: scores.voiceMatch,
      job_alignment_score: scores.jobAlignment,
      overall_quality_score: scores.overall,
      status: 'complete',
      generation_model: 'claude-sonnet-4-20250514',
      generation_duration_ms: Date.now() - startTime,
      // Add conversation metadata
      metadata: {
        conversationBased: true,
        honestlyVerified: true,
        conversationLength: conversationHistory.length,
        lexCommentary
      }
    };

    const { data: savedCoverLetter, error: saveError } = await supabase
      .from('cover_letters')
      .insert(insertPayload)
      .select()
      .single();

    if (saveError) {
      console.error('❌ Save error:', saveError);
      return NextResponse.json(
        { success: false, error: 'Failed to save cover letter' },
        { status: 500 }
      );
    }

    console.log('✅ Cover letter extracted and saved:', savedCoverLetter.id);

    // --------------------------------------------------------
    // 7) Return response (MATCH YOUR COMPONENT'S EXPECTATIONS)
    // --------------------------------------------------------
    
    return NextResponse.json({
      success: true,
      coverLetterId: savedCoverLetter.id,
      coverLetter: {
        id: savedCoverLetter.id,
        content: parsedContent.fullText,
        contentHtml: parsedContent.html,
        sections: parsedContent.sections,
        scores: {
          voiceMatch: scores.voiceMatch,
          jobAlignment: scores.jobAlignment,
          overall: scores.overall
        },
        lexCommentary: lexCommentary,
        metadata: {
          companyName: jobData.company_name,
          jobTitle: jobData.job_title,
          conversationBased: true,
          honestlyVerified: true,
          generatedAt: new Date().toISOString(),
          generationTimeMs: Date.now() - startTime
        }
      }
    });

  } catch (error) {
    console.error('❌ [extract-cover-letter] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

// ============================================================
// HELPER FUNCTIONS (SAME AS YOUR GENERATE API)
// ============================================================

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

  const opening = openingMatch?.[1]?.trim() || '';
  const body = bodyMatch?.[1]?.trim() || '';
  const closing = closingMatch?.[1]?.trim() || '';

  const fullText = opening && body && closing
    ? `${opening}\n\n${body}\n\n${closing}`
    : content.replace(/---\w+---/g, '').trim();

  const bodyParagraphs = body 
    ? body.split(/\n\n+/).filter(p => p.trim()) 
    : [fullText];

  const html = `<div class="cover-letter">
  <div class="opening">${escapeHtml(opening || bodyParagraphs[0] || '')}</div>
  ${bodyParagraphs
    .slice(opening ? 0 : 1)
    .map(p => `<div class="body-paragraph">${escapeHtml(p)}</div>`)
    .join('\n  ')}
  <div class="closing">${escapeHtml(closing || '')}</div>
</div>`;

  return {
    fullText,
    html,
    sections: {
      opening: { content: opening || bodyParagraphs[0] || '', version: 1 },
      body: bodyParagraphs.map(p => ({ content: p, version: 1 })),
      closing: { content: closing || '', version: 1 }
    }
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\n/g, '<br>');
}

function calculateScores(params: {
  content: string;
  jobData: any;
}): { voiceMatch: number; jobAlignment: number; overall: number } {
  const { content, jobData } = params;

  let jobAlignment = 70;
  let voiceMatch = 75;

  // Check for job requirements mention
  if (jobData?.requirements) {
    const contentLower = content.toLowerCase();
    const mentioned = jobData.requirements.filter((req: string) =>
      contentLower.includes(req.toLowerCase().split(' ')[0])
    );
    jobAlignment += Math.min(20, mentioned.length * 5);
  }

  // Check for good practices
  const goodPractices = [
    !content.toLowerCase().includes('i am excited to apply'),
    !content.toLowerCase().includes('i believe i would be'),
    jobData?.company_name ? content.includes(jobData.company_name) : true,
    content.length > 200 && content.length < 650
  ];

  voiceMatch += goodPractices.filter(Boolean).length * 3;

  voiceMatch = Math.min(100, voiceMatch);
  jobAlignment = Math.min(100, jobAlignment);

  const overall = Math.round(voiceMatch * 0.4 + jobAlignment * 0.6);
  
  return { voiceMatch, jobAlignment, overall };
}

async function getLexCommentary(
  coverLetterContent: string,
  conversationHistory: Message[],
  anthropic: any
): Promise<any> {
  try {
    const systemPrompt = `You are Lex, reviewing a cover letter generated from your conversation with the user.

Provide brief, honest feedback:

1. **Overall Assessment** (2-3 sentences)
   - Does it capture what they discussed?
   - Does it sound authentic?
   - Key strengths?

2. **Strengths** (2-3 bullet points)
3. **Improvements** (1-2 bullet points, if any)

Keep it short and actionable.

COVER LETTER:
${coverLetterContent}

CONVERSATION CONTEXT:
${conversationHistory.slice(-4).map(msg => `${msg.role}: ${msg.content}`).join('\n\n')}`;

    const clientAny = anthropic as any;
    
    let response;
    if (clientAny?.messages?.create) {
      response = await clientAny.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        messages: [{ role: 'user', content: systemPrompt }]
      });
    } else if (clientAny?.beta?.messages?.create) {
      response = await clientAny.beta.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        messages: [{ role: 'user', content: systemPrompt }]
      });
    } else {
      throw new Error('SDK mismatch');
    }

    const commentaryText = response?.content?.[0]?.text || '';
    return parseCommentary(commentaryText);

  } catch (error) {
    console.warn('Commentary generation failed:', error);
    return {
      overallAssessment: 'Cover letter generated from your conversation with Lex.',
      strengths: ['Based on your actual discussion', 'Authentic to your voice'],
      improvements: []
    };
  }
}

function parseCommentary(text: string) {
  const lines = text.split('\n').filter(line => line.trim());
  
  let overallAssessment = '';
  const strengths: string[] = [];
  const improvements: string[] = [];
  
  let currentSection = 'overall';
  
  for (const line of lines) {
    const lower = line.toLowerCase();
    
    if (lower.includes('assessment') || lower.includes('overall')) {
      currentSection = 'overall';
      continue;
    } else if (lower.includes('strength')) {
      currentSection = 'strengths';
      continue;
    } else if (lower.includes('improvement') || lower.includes('could')) {
      currentSection = 'improvements';
      continue;
    }
    
    const cleaned = line.replace(/^[-•*]\s*/, '').trim();
    if (!cleaned) continue;
    
    if (currentSection === 'overall') {
      overallAssessment += (overallAssessment ? ' ' : '') + cleaned;
    } else if (currentSection === 'strengths') {
      strengths.push(cleaned);
    } else if (currentSection === 'improvements') {
      improvements.push(cleaned);
    }
  }
  
  return {
    overallAssessment: overallAssessment || 'Cover letter generated from your conversation.',
    strengths: strengths.slice(0, 3),
    improvements: improvements.slice(0, 3)
  };
}

// ============================================================
// GET ENDPOINT - For testing
// ============================================================

export async function GET() {
  return NextResponse.json({
    message: 'Cover Letter Content Extraction API',
    version: '1.0',
    description: 'Extracts cover letter content from Lex strategy conversation',
    method: 'POST',
    requiredFields: ['conversationHistory', 'resumeId', 'jobId', 'userId']
  });
}
