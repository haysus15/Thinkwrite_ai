// Resume Builder Feedback API Route
// src/app/api/resume-builder/feedback/route.ts

import { NextRequest, NextResponse } from 'next/server';
import type { LexFeedbackRequest, SectionFeedback } from '@/types/resume-builder';

export async function POST(request: NextRequest) {
  try {
    const body: LexFeedbackRequest = await request.json();
    const { section, content, targetRole, targetIndustry } = body;

    if (!section || !content) {
      return NextResponse.json(
        { success: false, error: 'Section and content are required' },
        { status: 400 }
      );
    }

    // Build prompt based on section
    const prompt = buildFeedbackPrompt(section, content, targetRole, targetIndustry);

    // Call Claude API for Lex feedback
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.CLAUDE_API_KEY!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    const responseText = data.content?.[0]?.text || '';

    // Parse the response
    const feedback = parseFeedbackResponse(responseText, section);

    return NextResponse.json({ success: true, feedback });

  } catch (error) {
    console.error('Feedback error:', error);
    
    // Return fallback feedback on error
    return NextResponse.json({ 
      success: true, 
      feedback: getFallbackFeedback() 
    });
  }
}

function buildFeedbackPrompt(
  section: string, 
  content: any, 
  targetRole?: string, 
  targetIndustry?: string
): string {
  const roleContext = targetRole 
    ? `The user is targeting a ${targetRole} position${targetIndustry ? ` in the ${targetIndustry} industry` : ''}.` 
    : '';

  const sectionPrompts: Record<string, string> = {
    contact: `Review this contact information for a resume:
${JSON.stringify(content, null, 2)}

Check for:
- Professional email address
- Complete information (name, email, phone, location)
- LinkedIn profile presence
- Any formatting issues`,

    summary: `Review this professional summary:
"${content}"

Evaluate:
- Clear value proposition
- Specific skills and experience mentioned
- Quantifiable achievements
- Appropriate length (2-4 sentences ideal)
- Strong opening statement`,

    experience: `Review these work experience entries:
${JSON.stringify(content, null, 2)}

For each entry, evaluate:
- Strong action verbs at the start of bullets
- Quantified achievements (numbers, percentages, metrics)
- Results-focused language (not just duties)
- Relevant keywords for the target role
- Clear impact statements`,

    education: `Review these education entries:
${JSON.stringify(content, null, 2)}

Check for:
- Complete degree information
- Relevant coursework or honors mentioned
- Appropriate detail level based on career stage`,

    skills: `Review these skills groups:
${JSON.stringify(content, null, 2)}

Evaluate:
- Relevant skills for the target role
- Good balance of technical and soft skills
- Appropriate categorization
- No outdated or irrelevant skills`,

    projects: `Review these project entries:
${JSON.stringify(content, null, 2)}

Evaluate:
- Clear project descriptions
- Technologies/tools highlighted
- Quantified results where possible
- Relevance to target role`,

    certifications: `Review these certifications:
${JSON.stringify(content, null, 2)}

Check for:
- Relevance to target role
- Current/valid certifications
- Appropriate detail level`
  };

  return `You are Lex, an HR specialist and career coach. You're direct, encouraging, and genuinely want to help people succeed. You have insider knowledge from years in HR.

${roleContext}

${sectionPrompts[section] || `Review this resume section: ${JSON.stringify(content)}`}

Provide feedback in the following JSON format ONLY (no other text):
{
  "strengths": ["What's working well - be specific", "Another strength"],
  "improvements": [
    {
      "issue": "Specific issue identified",
      "suggestion": "How to fix it",
      "example": "Optional example of the improvement"
    }
  ],
  "rewrites": [
    {
      "original": "The original text that needs improvement",
      "suggested": "Your improved version",
      "reason": "Why this is better"
    }
  ],
  "overallTip": "One actionable piece of advice they should focus on",
  "score": 75
}

Be encouraging but honest. Give specific, actionable feedback. If suggesting rewrites, only include 1-3 of the most impactful ones.`;
}

function parseFeedbackResponse(responseText: string, section: string): SectionFeedback {
  try {
    // Try to extract JSON from the response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        strengths: parsed.strengths || [],
        improvements: parsed.improvements || [],
        rewrites: parsed.rewrites || [],
        overallTip: parsed.overallTip || "Keep refining this section!",
        score: parsed.score
      };
    }
  } catch (e) {
    console.error('Failed to parse feedback:', e);
  }
  
  return getFallbackFeedback();
}

function getFallbackFeedback(): SectionFeedback {
  return {
    strengths: ["You've made a good start on this section"],
    improvements: [
      {
        issue: "Could use more specific details",
        suggestion: "Try adding quantifiable achievements or specific examples",
        example: undefined
      }
    ],
    rewrites: [],
    overallTip: "Focus on being specific and highlighting your unique value. Numbers and concrete examples always strengthen your resume.",
    score: 65
  };
}