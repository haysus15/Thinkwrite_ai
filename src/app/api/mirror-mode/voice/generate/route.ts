// src/app/api/mirror-mode/voice/generate/route.ts
// Generate text in the user's authentic voice using their learned voice profile

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/getAuthUser';
import Anthropic from '@anthropic-ai/sdk';
import { type VoiceFingerprint } from '@/lib/mirror-core/voiceAnalysis';
import { getConfidenceLabel } from '@/lib/mirror-core/voiceAggregation';
import {
  buildVoiceSystemPrompt,
  getMaxTokens,
  VOICE_GENERATION_CONFIDENCE_THRESHOLD,
} from "@/lib/mirror-core/voiceGeneration";

export const runtime = 'nodejs';

function getClaudeApiKey(): string | null {
  return process.env.CLAUDE_API_KEY || null;
}

// Generation types supported
export type GenerationType =
  | 'freeform'        // Write anything in my voice
  | 'email'           // Professional email
  | 'message'         // Casual message/text
  | 'bio'             // Bio/about me
  | 'post'            // Social media post
  | 'paragraph'       // Single paragraph on a topic
  | 'rewrite';        // Rewrite existing text in my voice

export type GenerationRequest = {
  type: GenerationType;
  prompt: string;              // What to write about
  originalText?: string;       // For rewrite mode
  tone?: 'match' | 'formal' | 'casual';  // Override or match learned voice
  length?: 'short' | 'medium' | 'long';
  context?: string;            // Additional context
};

/**
 * POST /api/mirror-mode/voice/generate
 *
 * Generate text in the user's learned voice.
 * Requires a voice profile with confidence >= 25 (Learning or higher)
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const supabase = await createSupabaseServerClient();
    const body: GenerationRequest = await req.json();
    const { type, prompt, originalText, tone = 'match', length = 'medium', context } = body;

    // Validate required fields
    if (!prompt && type !== 'rewrite') {
      return NextResponse.json(
        { success: false, error: 'prompt is required' },
        { status: 400 }
      );
    }

    if (type === 'rewrite' && !originalText) {
      return NextResponse.json(
        { success: false, error: 'originalText is required for rewrite mode' },
        { status: 400 }
      );
    }

    // Check for API key
    const apiKey = getClaudeApiKey();
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'AI service not configured' },
        { status: 500 }
      );
    }

    // Fetch user's voice profile
    const { data: profile, error: profileError } = await supabase
      .from('voice_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({
        success: false,
        error: 'No voice profile found. Upload documents to Mirror Mode first.',
        needsTraining: true,
      }, { status: 404 });
    }

    // Check confidence level
    const confidenceLevel = profile.confidence_level || 0;
    if (confidenceLevel < VOICE_GENERATION_CONFIDENCE_THRESHOLD) {
      return NextResponse.json({
        success: false,
        error: `Voice profile is still initializing (${confidenceLevel}% confidence). Upload more documents to reach at least ${VOICE_GENERATION_CONFIDENCE_THRESHOLD}% confidence.`,
        currentConfidence: confidenceLevel,
        needsTraining: true,
      }, { status: 400 });
    }

    const fingerprint = profile.aggregate_fingerprint as VoiceFingerprint;

    // Build the voice-aware prompt
    const systemPrompt = buildVoiceSystemPrompt(fingerprint, tone);
    const userPrompt = buildUserPrompt(type, prompt, originalText, length, context);

    // Generate with Claude
    const anthropic = new Anthropic({ apiKey });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: getMaxTokens(length),
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt }
      ],
    });

    // Extract the generated text
    const generatedText = response.content
      .filter(block => block.type === 'text')
      .map(block => (block as { type: 'text'; text: string }).text)
      .join('\n');

    // Log generation for analytics (optional)
    await logGeneration(supabase, userId, type, prompt.substring(0, 100), generatedText.length);

    return NextResponse.json({
      success: true,
      generated: {
        text: generatedText,
        type,
        voiceConfidence: confidenceLevel,
        voiceLabel: getConfidenceLabel(confidenceLevel),
      },
      meta: {
        model: 'claude-sonnet-4-20250514',
        tokensUsed: response.usage?.output_tokens || 0,
        generatedAt: new Date().toISOString(),
      }
    });

  } catch (error: any) {
    console.error('Voice generation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate text',
        details: error?.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}


/**
 * Build the user prompt based on generation type
 */
function buildUserPrompt(
  type: GenerationType,
  prompt: string,
  originalText: string | undefined,
  length: 'short' | 'medium' | 'long',
  context: string | undefined
): string {
  const lengthGuide = {
    short: '1-2 paragraphs or 50-100 words',
    medium: '2-4 paragraphs or 100-250 words',
    long: '4-6 paragraphs or 250-500 words'
  };

  const contextNote = context ? `\n\nAdditional context: ${context}` : '';

  switch (type) {
    case 'rewrite':
      return `Rewrite the following text in the user's voice. Keep the same meaning and key points, but transform the style to match their writing patterns exactly.

ORIGINAL TEXT:
"""
${originalText}
"""

${prompt ? `Additional instructions: ${prompt}` : ''}${contextNote}

Provide only the rewritten text, no explanations.`;

    case 'email':
      return `Write a professional email in the user's voice.

Topic/Purpose: ${prompt}

Target length: ${lengthGuide[length]}${contextNote}

Write only the email body (no subject line unless specifically requested). Match the user's voice exactly.`;

    case 'message':
      return `Write a casual message/text in the user's voice.

What to say: ${prompt}

Target length: ${lengthGuide.short}${contextNote}

Keep it natural and conversational, matching how this person actually writes messages.`;

    case 'bio':
      return `Write a bio/about section in the user's voice.

Details to include: ${prompt}

Target length: ${lengthGuide[length]}${contextNote}

This should sound like the user wrote it themselves - authentic and personal.`;

    case 'post':
      return `Write a social media post in the user's voice.

Topic/Message: ${prompt}

Target length: ${lengthGuide.short}${contextNote}

Match their casual writing style and how they'd naturally express this.`;

    case 'paragraph':
      return `Write a paragraph about the following topic in the user's voice.

Topic: ${prompt}

Target length: ${lengthGuide[length]}${contextNote}

This should read like something the user would naturally write.`;

    case 'freeform':
    default:
      return `Write the following in the user's voice:

${prompt}

Target length: ${lengthGuide[length]}${contextNote}

Match their writing style exactly. The output should sound like they wrote it themselves.`;
  }
}

/**
 * Log generation for analytics (creates table if needed)
 */
async function logGeneration(
  supabase: any,
  userId: string,
  type: string,
  promptPreview: string,
  outputLength: number
): Promise<void> {
  try {
    await supabase.from('mirror_generations').insert({
      user_id: userId,
      generation_type: type,
      prompt_preview: promptPreview,
      output_length: outputLength,
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    // Silent fail - logging shouldn't break generation
    console.log('Generation logging skipped (table may not exist)');
  }
}
