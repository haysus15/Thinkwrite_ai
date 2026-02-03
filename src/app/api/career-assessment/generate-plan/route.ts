// src/app/api/career-assessment/generate-plan/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { VoiceProfileService } from '@/services/voice-profile';
import { getAuthUser, createSupabaseAdmin } from '@/lib/auth/getAuthUser';

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY!, // Uses Claude API key from env
});

export async function POST(request: NextRequest) {
  try {
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { conversationMessages, messages, resumeId } = body;
    const rawMessages = conversationMessages || messages;

    if (!rawMessages || rawMessages.length === 0) {
      return NextResponse.json(
        { success: false, error: 'conversationMessages required' },
        { status: 400 }
      );
    }

    console.log('🎯 Starting career plan generation...');
    console.log(`📊 User: ${userId}`);
    console.log(`📊 Messages: ${rawMessages.length}`);

    const normalizedMessages = rawMessages.map((msg: any) => ({
      role: msg.role || (msg.sender === 'lex' ? 'assistant' : msg.sender === 'user' ? 'user' : 'user'),
      content: msg.content || msg.text || ''
    }));

    const voiceContext = await VoiceProfileService.getGenerationContext(userId, "career");
    const systemPrompt = `You are Lex, a career advisor with deep HR expertise. You help users craft authentic, compelling career documents that showcase their real experience and value.

Your approach:
- Guide through conversation, don't auto-generate fabricated content
- Help users articulate their actual achievements powerfully
- Be direct but supportive, like a trusted mentor
- Focus on what makes this person uniquely valuable

${voiceContext.promptInjection}

${voiceContext.readiness.shouldWarn ? `Note: ${voiceContext.readiness.lexMessage}` : ''}`;

    // Build conversation history for Claude
    const conversationText = normalizedMessages
      .map((msg: any) => `${msg.role === 'user' ? 'User' : 'Lex'}: ${msg.content}`)
      .join('\n\n');

    console.log(`📝 Conversation length: ${conversationText.length} characters`);

    // Extract structured data from conversation using Claude
    const extractionPrompt = `You are analyzing a career assessment conversation between a user and Lex, an AI career advisor.

Your task is to extract structured career data from this conversation and generate a comprehensive career profile and action plan.

CONVERSATION:
${conversationText}

EXTRACT THE FOLLOWING IN JSON FORMAT (respond with ONLY valid JSON, no markdown, no explanation):

{
  "profile": {
    "currentTitle": "string or null",
    "currentCompany": "string or null",
    "energyLevel": number 1-10 or null,
    "primaryDrains": ["array of specific energy drains mentioned"],
    "primaryGains": ["array of specific energy gains mentioned"],
    "compensationMinimum": number or null,
    "compensationTarget": number or null,
    "locationType": "remote" | "hybrid" | "onsite" | "flexible" or null,
    "companyStage": "startup" | "scale-up" | "enterprise" | "nonprofit" or null,
    "targetTitle": "string or null",
    "targetCompanies": ["array of companies mentioned"],
    "dailyWorkDescription": "string describing ideal daily work or null",
    "impactGoal": "string describing desired impact or null",
    "skillGaps": [{"skill": "string", "priority": number 1-10}],
    "experienceGaps": ["array of experience gaps"],
    "readinessScore": number 0-100 or null,
    "primaryMotivation": "string or null",
    "riskFactors": ["array of risk factors or obstacles"]
  },
  "actionPlan": {
    "totalMonths": number,
    "hoursPerWeek": number,
    "estimatedCost": number,
    "phases": [
      {
        "phaseNumber": number,
        "title": "string",
        "duration": "string like '0-3 months'",
        "items": [
          {
            "category": "skill-development" | "networking" | "certification" | "portfolio" | "job-search",
            "action": "specific action to take",
            "why": "why this matters for their goals",
            "resources": [
              {
                "name": "resource name",
                "url": "URL or null",
                "cost": number or null,
                "time": "time commitment like '20 hours' or null"
              }
            ]
          }
        ]
      }
    ]
  }
}

CRITICAL RULES:
1. Respond with ONLY the JSON object - no markdown code blocks, no explanation text
2. All arrays must have at least empty arrays [], never null
3. All string fields can be null if not mentioned in conversation
4. Be brutally honest about readiness scores and gaps
5. Make action plan realistic with actual timelines and costs
6. Prioritize high-impact actions that close the biggest gaps

Return your response now:`;

    console.log('🤖 Calling Claude API...');

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: extractionPrompt,
        },
      ],
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
    
    console.log('📥 Claude response length:', responseText.length);
    console.log('📥 First 200 chars:', responseText.substring(0, 200));

    // Clean up response - remove markdown code blocks if present
    let cleanedResponse = responseText.trim();
    
    // Remove markdown code blocks
    if (cleanedResponse.startsWith('```json')) {
      cleanedResponse = cleanedResponse.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    } else if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }
    
    console.log('🧹 Cleaned response length:', cleanedResponse.length);

    // Parse the JSON response
    let extractedData;
    try {
      extractedData = JSON.parse(cleanedResponse);
      console.log('✅ JSON parsed successfully');
      console.log('📊 Has profile?', !!extractedData.profile);
      console.log('📊 Has actionPlan?', !!extractedData.actionPlan);
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError);
      console.error('📄 Response text:', cleanedResponse);
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to parse career assessment data',
          details: 'Claude response was not valid JSON',
          response: cleanedResponse.substring(0, 500),
        },
        { status: 500 }
      );
    }

    // Validate the structure
    if (!extractedData.profile || !extractedData.actionPlan) {
      console.error('❌ Missing required fields');
      console.error('📄 Extracted data:', JSON.stringify(extractedData, null, 2));
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid data structure from Claude',
          details: 'Missing profile or actionPlan',
        },
        { status: 500 }
      );
    }

    console.log('💾 Saving to database...');

    // Save to database
    const supabase = createSupabaseAdmin();
    const { data: assessment, error: dbError } = await supabase
      .from('career_assessments')
      .insert({
        user_id: userId,
        resume_id: resumeId || null,
        conversation_messages: normalizedMessages,
        profile: extractedData.profile,
        action_plan: extractedData.actionPlan,
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (dbError) {
      console.error('❌ Database error:', dbError);
      return NextResponse.json(
        { success: false, error: dbError.message },
        { status: 500 }
      );
    }

    console.log('✅ Assessment saved:', assessment.id);

    return NextResponse.json({
      success: true,
      assessment,
      profile: extractedData.profile,
      actionPlan: extractedData.actionPlan,
      voiceMetadata: {
        usedVoiceProfile: voiceContext.hasVoiceProfile && voiceContext.readiness.isReady,
        confidenceLevel: voiceContext.readiness.score,
        shouldAskFeedback: voiceContext.readiness.shouldWarn,
      },
    });
  } catch (error: any) {
    console.error('❌ Error generating career plan:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
