// src/app/api/career-assessment/check-completeness/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getAuthUser } from '@/lib/auth/getAuthUser';

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY!,
});

export async function POST(request: NextRequest) {
  try {
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const rawMessages = body?.conversationMessages || body?.messages;

    if (!rawMessages || rawMessages.length === 0) {
      return NextResponse.json(
        { success: false, error: 'conversationMessages required' },
        { status: 400 }
      );
    }

    const normalizedMessages = rawMessages.map((msg: any) => ({
      role: msg.role || (msg.sender === 'lex' ? 'assistant' : msg.sender === 'user' ? 'user' : 'user'),
      content: msg.content || msg.text || ''
    }));

    const conversationText = normalizedMessages
      .map((msg: any) => `${msg.role === 'user' ? 'User' : 'Lex'}: ${msg.content}`)
      .join('\n\n');

    const prompt = `You are checking if a career assessment conversation has all required fields.

REQUIRED FIELDS (use reasonable inference and be lenient):
- current_role_title
- compensation_target
- location_preference
- company_stage_preference
- target_title
- skill_gaps
- experience_gaps

LENIENCY RULES:
- If compensation minimum is not explicit but a target is given, treat minimum as satisfied.
- If energy drains/gains are not explicit but user indicates workload is manageable or no major drains, treat as satisfied.
- If ideal daily work or impact goal is implied by the vision, treat as satisfied.
- Only mark missing if clearly absent or contradicted.

Conversation:
${conversationText}

Return ONLY valid JSON:
{
  "isComplete": boolean,
  "missingFields": ["field_key", ...]
}

If unclear or missing, include the field in missingFields.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      system: 'You are a precise validator. Output only JSON.',
      messages: [{ role: 'user', content: prompt }],
    });

    const responseText = response.content[0].type === 'text' ? response.content[0].text : '';

    let cleaned = responseText.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (err) {
      return NextResponse.json(
        { success: false, error: 'Failed to parse completeness response' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      isComplete: Boolean(parsed?.isComplete),
      missingFields: Array.isArray(parsed?.missingFields) ? parsed.missingFields : [],
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Completeness check failed' },
      { status: 500 }
    );
  }
}
