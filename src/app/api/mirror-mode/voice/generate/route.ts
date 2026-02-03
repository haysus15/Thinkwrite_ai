// src/app/api/mirror-mode/voice/generate/route.ts
// Generate text in the user's authentic voice using their learned voice profile

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/getAuthUser';
import Anthropic from '@anthropic-ai/sdk';
import { type VoiceFingerprint } from '@/lib/mirror-mode/voiceAnalysis';
import { getConfidenceLabel } from '@/lib/mirror-mode/voiceAggregation';

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
    if (confidenceLevel < 25) {
      return NextResponse.json({
        success: false,
        error: `Voice profile is still initializing (${confidenceLevel}% confidence). Upload more documents to reach at least 25% confidence.`,
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
 * Build the system prompt that instructs Claude to write in the user's voice
 */
function buildVoiceSystemPrompt(fp: VoiceFingerprint, toneOverride: 'match' | 'formal' | 'casual'): string {
  const voiceTraits = buildDetailedVoiceDescription(fp);

  let toneInstruction = '';
  if (toneOverride === 'formal') {
    toneInstruction = '\n\nIMPORTANT: For this specific request, lean MORE FORMAL than the user\'s typical style, but keep their other voice characteristics.';
  } else if (toneOverride === 'casual') {
    toneInstruction = '\n\nIMPORTANT: For this specific request, lean MORE CASUAL than the user\'s typical style, but keep their other voice characteristics.';
  }

  return `You are a writing assistant specialized in voice matching. Your job is to generate text that sounds EXACTLY like a specific person wrote it.

═══════════════════════════════════════════════════════════════
THE USER'S WRITING VOICE - MATCH THIS PRECISELY
═══════════════════════════════════════════════════════════════

${voiceTraits}

═══════════════════════════════════════════════════════════════
VOICE MATCHING RULES
═══════════════════════════════════════════════════════════════

1. SENTENCE STRUCTURE: Match their average sentence length and variation pattern exactly
2. VOCABULARY: Use words at their complexity level - don't simplify or overcomplicate
3. PUNCTUATION: Mirror their punctuation habits (dashes, exclamations, questions, etc.)
4. TONE: Match their formality level and assertiveness
5. PRONOUNS: If they use "I/me/my" frequently, do the same. If they're impersonal, stay impersonal.
6. CONTRACTIONS: Use them if they do, avoid them if they don't
7. TRANSITIONS: Use their style of connecting ideas

DO NOT:
- Add personality traits they don't have
- Make the writing "better" - match their actual style
- Add exclamation marks if they rarely use them
- Use fancy vocabulary if they prefer simple words
- Hedge if they're assertive, or vice versa

The goal is for the user to read this and think "I could have written that myself."${toneInstruction}`;
}

/**
 * Build a detailed voice description from the fingerprint
 */
function buildDetailedVoiceDescription(fp: VoiceFingerprint): string {
  const sections: string[] = [];

  // Sentence Structure
  const sentenceStyle = [];
  if (fp.rhythm.avgSentenceLength > 22) {
    sentenceStyle.push('Writes in longer, complex sentences (avg ~' + Math.round(fp.rhythm.avgSentenceLength) + ' words)');
  } else if (fp.rhythm.avgSentenceLength < 12) {
    sentenceStyle.push('Writes in short, punchy sentences (avg ~' + Math.round(fp.rhythm.avgSentenceLength) + ' words)');
  } else {
    sentenceStyle.push('Uses medium-length sentences (avg ~' + Math.round(fp.rhythm.avgSentenceLength) + ' words)');
  }

  if (fp.rhythm.sentenceVariation > 8) {
    sentenceStyle.push('Varies sentence length significantly for rhythm');
  } else if (fp.rhythm.sentenceVariation < 3) {
    sentenceStyle.push('Keeps sentence lengths consistent');
  }

  if (fp.rhythm.shortSentenceRatio > 0.25) {
    sentenceStyle.push('Uses short sentences for emphasis');
  }
  sections.push('SENTENCE STRUCTURE:\n' + sentenceStyle.map(s => '• ' + s).join('\n'));

  // Vocabulary
  const vocabStyle = [];
  if (fp.vocabulary.complexWordRatio > 0.18) {
    vocabStyle.push('Uses sophisticated, complex vocabulary');
  } else if (fp.vocabulary.complexWordRatio < 0.08) {
    vocabStyle.push('Prefers simple, accessible words');
  } else {
    vocabStyle.push('Uses moderately complex vocabulary');
  }

  if (fp.vocabulary.contractionRatio > 0.02) {
    vocabStyle.push('Uses contractions freely (don\'t, won\'t, it\'s)');
  } else if (fp.vocabulary.contractionRatio < 0.005) {
    vocabStyle.push('Avoids contractions (writes "do not" instead of "don\'t")');
  }

  if (fp.vocabulary.topWords && fp.vocabulary.topWords.length > 0) {
    vocabStyle.push('Frequently uses words like: ' + fp.vocabulary.topWords.slice(0, 8).join(', '));
  }
  sections.push('VOCABULARY:\n' + vocabStyle.map(s => '• ' + s).join('\n'));

  // Tone & Voice
  const toneStyle = [];
  if (fp.voice.formalityScore > 0.7) {
    toneStyle.push('Very formal, professional tone');
  } else if (fp.voice.formalityScore > 0.5) {
    toneStyle.push('Moderately formal tone');
  } else if (fp.voice.formalityScore > 0.3) {
    toneStyle.push('Conversational, approachable tone');
  } else {
    toneStyle.push('Casual, informal tone');
  }

  if (fp.voice.assertiveDensity > 0.01) {
    toneStyle.push('Makes direct, confident assertions ("clearly", "obviously", "definitely")');
  } else if (fp.voice.hedgeDensity > 0.02) {
    toneStyle.push('Tends to hedge and qualify ("maybe", "perhaps", "I think")');
  }

  if (fp.voice.personalPronounRate > 0.05) {
    toneStyle.push('Writes with strong personal voice (frequent "I", "me", "my")');
  } else if (fp.voice.personalPronounRate < 0.01) {
    toneStyle.push('Uses impersonal, third-person perspective');
  }

  if (fp.voice.activeVoiceRatio > 0.7) {
    toneStyle.push('Prefers active voice');
  } else if (fp.voice.activeVoiceRatio < 0.5) {
    toneStyle.push('Uses passive voice frequently');
  }
  sections.push('TONE & VOICE:\n' + toneStyle.map(s => '• ' + s).join('\n'));

  // Punctuation
  const punctStyle = [];
  if (fp.punctuation.exclamationRate > 5) {
    punctStyle.push('Uses exclamation marks expressively!');
  } else if (fp.punctuation.exclamationRate < 1) {
    punctStyle.push('Rarely uses exclamation marks');
  }

  if (fp.punctuation.questionRate > 10) {
    punctStyle.push('Frequently poses rhetorical questions');
  }

  if (fp.punctuation.dashRate > 5) {
    punctStyle.push('Uses em-dashes for emphasis and asides');
  }

  if (fp.punctuation.semicolonRate > 3) {
    punctStyle.push('Uses semicolons to connect related ideas');
  }

  if (fp.punctuation.ellipsisRate > 2) {
    punctStyle.push('Uses ellipses for trailing thoughts...');
  }

  if (punctStyle.length > 0) {
    sections.push('PUNCTUATION HABITS:\n' + punctStyle.map(s => '• ' + s).join('\n'));
  }

  // Rhetorical Patterns
  const rhetStyle = [];
  if (fp.rhetoric.transitionWordRate > 0.15) {
    rhetStyle.push('Connects ideas with transitions (however, therefore, moreover)');
  }

  if (fp.rhetoric.questionOpenerRate > 0.1) {
    rhetStyle.push('Opens sections with questions to engage readers');
  }

  if (fp.rhetoric.listUsageRate > 0.05) {
    rhetStyle.push('Uses lists and enumerations');
  }

  if (fp.rhetoric.exampleUsageRate > 0.03) {
    rhetStyle.push('Illustrates points with examples');
  }

  if (rhetStyle.length > 0) {
    sections.push('RHETORICAL PATTERNS:\n' + rhetStyle.map(s => '• ' + s).join('\n'));
  }

  return sections.join('\n\n');
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
 * Get max tokens based on length preference
 */
function getMaxTokens(length: 'short' | 'medium' | 'long'): number {
  switch (length) {
    case 'short': return 300;
    case 'medium': return 600;
    case 'long': return 1200;
    default: return 600;
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
