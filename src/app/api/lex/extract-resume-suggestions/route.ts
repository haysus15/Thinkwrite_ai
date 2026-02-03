// Extract Resume Suggestions from Lex Conversation & Create Database Record
// src/app/api/lex/extract-resume-suggestions/route.ts
// UPDATED: Now parses resume into structured format before saving

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, createSupabaseAdmin } from '@/lib/auth/getAuthUser';

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return NextResponse.json({ error: authError || 'Authentication required' }, { status: 401 });
    }

    const supabase = createSupabaseAdmin();
    const body = await request.json();
    const { conversationHistory, resumeId, jobId } = body;

    if (!conversationHistory || !Array.isArray(conversationHistory)) {
      return NextResponse.json(
        { error: 'conversationHistory array required' },
        { status: 400 }
      );
    }

    console.log('Extracting resume suggestions from Lex conversation...');
    console.log(`Analyzing ${conversationHistory.length} messages...`);

    // Extract suggestions using Claude
    const extraction = await extractSuggestionsFromConversation(conversationHistory);

    console.log(`Extracted ${extraction.suggestions.length} suggestions`);

    const { data: job, error: jobError } = await supabase
      .from('job_analyses')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', userId)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Get resume directly from database (to ensure we have extracted_text)
    console.log('Fetching resume from database...');
    const { data: resume, error: resumeError } = await supabase
      .from('user_documents')
      .select('id, file_name, extracted_text')
      .eq('id', resumeId)
      .eq('user_id', userId)
      .single();

    if (resumeError || !resume) {
      console.error('Resume fetch error:', resumeError);
      return NextResponse.json(
        { error: 'Resume not found', details: resumeError?.message },
        { status: 404 }
      );
    }

    console.log('Resume fetched:', resume.file_name);
    console.log(`Resume text length: ${resume.extracted_text?.length || 0} characters`);

    // Validate we have text to parse
    if (!resume.extracted_text || resume.extracted_text.trim().length === 0) {
      console.error('Resume has no extracted text');
      return NextResponse.json(
        { error: 'Resume has no text content. Please re-upload the resume.' },
        { status: 400 }
      );
    }

    // Parse the resume text into structured format
    console.log('Parsing resume into structured format...');
    const structuredResume = await parseResumeToStructured(resume.extracted_text);
    console.log('Resume parsed successfully');
    console.log(`Parsed sections: ${Object.keys(structuredResume).join(', ')}`);

    // Create database record with conversation-extracted changes
    const tailoredResumeRecord = {
      user_id: userId,
      resume_id: resumeId,
      job_id: jobId,
      version_number: 1,
      tailoring_level: 'conversation' as const,
      original_content: structuredResume,  // ✅ NOW HAS ACTUAL CONTENT
      tailored_content: structuredResume,  // ✅ NOW HAS ACTUAL CONTENT
      changes: extraction.suggestions.map((sug, index) => ({
        id: `change-${index + 1}`,
        section: sug.section,
        subsection: sug.subsection || '',
        original: sug.original,
        tailored: sug.suggested,
        reason: sug.reason,
        conversationContext: sug.conversationContext,
        impact: sug.impact,
        status: 'pending',
        lexTip: sug.reason,
        keywords: sug.keywords || [],
        honestyFlag: sug.honestyFlag || 'SAFE'
      })),
      changes_accepted: 0,
      changes_rejected: 0,
      changes_pending: extraction.suggestions.length,
      lex_commentary: {
        overallAssessment: `Based on our conversation, here's what we discussed for the ${job.job_title} role.`,
        tailoringStrategy: extraction.conversationInsights?.careerStrategy || 'Conversation-driven tailoring',
        keyImprovements: extraction.conversationInsights?.keyReframes || [],
        honestFeedback: extraction.conversationInsights?.userGoal || 'Strategic positioning discussed in conversation',
        interviewTips: [],
        perChangeComments: {},
        honestyReport: 'All changes marked SAFE - based on honest conversation',
        recommendConversation: false,
        conversationTopics: []
      },
      conversation_insights: extraction.conversationInsights,
      is_finalized: false,
      source: 'conversation',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Save to database (using UPSERT to handle duplicates)
    const { data: savedRecord, error: saveError } = await supabase
      .from('tailored_resumes')
      .upsert(tailoredResumeRecord, {
        onConflict: 'user_id,job_analysis_id,version_number'
      })
      .select()
      .single();

    if (saveError) {
      console.error('Failed to save tailored resume:', saveError);
      return NextResponse.json(
        { error: 'Failed to save tailored resume record', details: saveError.message },
        { status: 500 }
      );
    }

    console.log(`Created tailored resume record: ${savedRecord.id}`);

    return NextResponse.json({
      success: true,
      tailoredResumeId: savedRecord.id,
      suggestions: extraction.suggestions,
      conversationInsights: extraction.conversationInsights,
      resumeId,
      jobId
    });

  } catch (error) {
    console.error('Extraction error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Extraction failed' 
      },
      { status: 500 }
    );
  }
}

async function extractSuggestionsFromConversation(
  conversation: ConversationMessage[]
): Promise<any> {
  
  const conversationText = conversation
    .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
    .join('\n\n');

  const prompt = `You are analyzing a conversation between a user and Lex (an HR specialist) about tailoring a resume. Extract SPECIFIC, ACTIONABLE resume changes that Lex suggested.

CONVERSATION:
${conversationText}

YOUR TASK:
1. Identify the user's TRUE GOAL (why they want this job, their career strategy)
2. Extract SPECIFIC resume changes Lex suggested
3. Include the CONVERSATION CONTEXT that justifies each change

RULES:
- Only extract changes that are HONEST (based on real experience)
- Each change must be SPECIFIC (exact section, exact text)
- Include Lex's reasoning from the conversation
- Mark everything as honestyFlag: "SAFE" since these came from honest conversation

EXAMPLES OF WHAT TO EXTRACT:

User said: "I want tactical brokerage experience for my broker exam"
Lex suggested: "Reframe your professional summary to explain this career move"

→ Extract:
{
  "section": "summary",
  "original": "[Infer what they likely have - e.g., 'Trade compliance specialist with 4 years experience...']",
  "suggested": "Customs compliance professional transitioning from advisory/systems role to hands-on brokerage operations. 4 years managing U.S./Canadian customs compliance... Currently preparing for Customs Broker License Exam and seeking operational entry processing experience to complement technical compliance background.",
  "reason": "Explains career move as intentional, signals long-term commitment",
  "conversationContext": "User is preparing for broker exam and wants tactical experience to complement technical background",
  "honestyFlag": "SAFE",
  "impact": "high",
  "keywords": ["Customs Broker License", "hands-on brokerage operations", "operational entry processing"]
}

User said: "How do I reframe my experience?"
Lex suggested: "Lead with brokerage operations instead of advisory work"

→ Extract:
{
  "section": "experience",
  "subsection": "job-1-bullet-1",
  "original": "[Infer - e.g., 'Provided expert guidance on customs compliance across multiple jurisdictions']",
  "suggested": "Process ISF, AMS, and entry documentation for ocean, air, and ground shipments across multiple product categories, maintaining compliance with CBP regulations and client-specific requirements",
  "reason": "Emphasizes hands-on processing over advisory work",
  "conversationContext": "User needs to show they can do tactical work, not just advise on it",
  "honestyFlag": "SAFE",
  "impact": "high",
  "keywords": ["ISF", "AMS", "entry documentation", "CBP regulations"]
}

Lex said: "Add this to skills"

→ Extract:
{
  "section": "skills",
  "subsection": "skill-group-1",
  "original": "[Infer current skills if mentioned]",
  "suggested": "Microsoft Office Suite (Advanced): Excel (VLOOKUP, pivot tables, data validation for entry accuracy), Word (customs documentation, correspondence), Outlook (client communication, deadline management)",
  "reason": "Job specifically requires Microsoft Office proficiency",
  "conversationContext": "Job posting emphasizes Microsoft Office, need to show advanced proficiency",
  "honestyFlag": "SAFE",
  "impact": "medium",
  "keywords": ["Microsoft Office", "Excel", "VLOOKUP", "pivot tables"]
}

IMPORTANT PATTERNS:
- New section additions (like "Professional Development" for broker exam prep)
- Experience reordering (lead with most relevant)
- Bullet point rewrites (emphasize different aspects)
- Skills section restructuring
- Summary/objective changes

Return JSON:
{
  "suggestions": [
    {
      "section": "summary|experience|skills|education|projects",
      "subsection": "specific location if applicable",
      "original": "what they likely have now (infer from context)",
      "suggested": "Lex's suggested reframe",
      "reason": "why this change helps",
      "conversationContext": "the key insight from conversation",
      "honestyFlag": "SAFE",
      "impact": "high|medium|low",
      "keywords": ["relevant", "keywords"]
    }
  ],
  "conversationInsights": {
    "userGoal": "What the user actually wants from this job/career move",
    "careerStrategy": "The strategy that emerged from the conversation",
    "keyReframes": ["Top 3-5 strategic reframes Lex suggested"]
  }
}

CRITICAL:
- Only extract changes Lex SPECIFICALLY suggested
- Don't invent changes that weren't discussed
- If Lex said "you might consider X" but didn't give specifics, note it in keyReframes but not in suggestions
- All suggestions must be ACTIONABLE (specific section + specific rewrite)
- Infer original text from conversation context when possible

Return ONLY valid JSON.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.CLAUDE_API_KEY!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    const content = data.content[0]?.text || '{}';
    const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
    const result = JSON.parse(cleanedContent);

    return {
      success: true,
      suggestions: result.suggestions || [],
      conversationInsights: result.conversationInsights || {
        userGoal: 'Not clearly identified',
        careerStrategy: 'Needs discussion',
        keyReframes: []
      }
    };

  } catch (error) {
    console.error('Claude extraction error:', error);
    throw new Error('Failed to extract suggestions from conversation');
  }
}

// Parse raw resume text into structured format
async function parseResumeToStructured(resumeText: string): Promise<any> {
  // Validate input
  if (!resumeText || resumeText.trim().length === 0) {
    console.error('Resume parsing: No text provided');
    throw new Error('No resume text to parse');
  }
  
  console.log(`Resume text length: ${resumeText.length} characters`);
  console.log(`First 200 chars: ${resumeText.substring(0, 200)}...`);
  
  const prompt = `Parse this resume into a structured JSON format. Extract ALL information accurately.

CRITICAL: You MUST extract the actual content, not just create empty structures!

RESUME TEXT:
${resumeText}

Return a complete JSON object with ALL extracted data:
{
  "contactInfo": {
    "name": "EXTRACT THE ACTUAL NAME",
    "email": "EXTRACT THE EMAIL",
    "phone": "EXTRACT THE PHONE",
    "location": "EXTRACT THE LOCATION",
    "linkedin": "EXTRACT IF PRESENT",
    "website": "EXTRACT IF PRESENT"
  },
  "summary": {
    "type": "summary",
    "content": "EXTRACT THE FULL PROFESSIONAL SUMMARY OR OBJECTIVE"
  },
  "experience": {
    "type": "experience",
    "jobs": [
      {
        "id": "job-0",
        "title": "EXTRACT JOB TITLE",
        "company": "EXTRACT COMPANY NAME",
        "location": "EXTRACT LOCATION",
        "startDate": "EXTRACT START DATE",
        "endDate": "EXTRACT END DATE or null if current",
        "current": true/false,
        "bullets": [
          { "id": "job-0-bullet-0", "content": "EXTRACT EACH BULLET POINT" }
        ]
      }
    ]
  },
  "skills": {
    "type": "skills",
    "groups": [
      {
        "id": "skill-group-0",
        "category": "EXTRACT CATEGORY NAME (e.g., Technical Skills)",
        "skills": ["EXTRACT", "ALL", "SKILLS"]
      }
    ]
  },
  "education": {
    "type": "education",
    "entries": [
      {
        "id": "edu-0",
        "degree": "EXTRACT DEGREE",
        "institution": "EXTRACT SCHOOL",
        "location": "EXTRACT LOCATION",
        "graduationDate": "EXTRACT DATE",
        "gpa": "EXTRACT IF PRESENT",
        "honors": ["EXTRACT IF PRESENT"],
        "relevantCoursework": ["EXTRACT IF PRESENT"]
      }
    ]
  },
  "certifications": {
    "type": "certifications",
    "entries": [
      {
        "id": "cert-0",
        "name": "EXTRACT CERTIFICATION NAME",
        "issuer": "EXTRACT ISSUER",
        "date": "EXTRACT DATE"
      }
    ]
  },
  "projects": {
    "type": "projects",
    "entries": [
      {
        "id": "proj-0",
        "name": "EXTRACT PROJECT NAME",
        "description": "EXTRACT DESCRIPTION",
        "technologies": ["EXTRACT TECHNOLOGIES"],
        "bullets": [{ "id": "proj-0-bullet-0", "content": "EXTRACT BULLET" }]
      }
    ]
  }
}

IMPORTANT: Extract ALL jobs (job-0, job-1, job-2, etc), ALL bullets, ALL skills groups. Do NOT return empty arrays if data exists!

Return ONLY valid JSON, no markdown.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 8000  // Increased from 4000
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0]) {
      throw new Error('Invalid OpenAI response structure');
    }
    
    const content = data.choices[0]?.message?.content || '{}';
    
    // Clean and parse JSON
    const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
    const parsedResume = JSON.parse(cleanedContent);
    
    // VALIDATE that we actually got data
    const hasName = parsedResume.contactInfo?.name && parsedResume.contactInfo.name !== 'Your Name';
    const hasJobs = parsedResume.experience?.jobs?.length > 0;
    const hasSkills = parsedResume.skills?.groups?.length > 0;
    const hasSummary = parsedResume.summary?.content && parsedResume.summary.content.length > 10;
    
    console.log('Parsing validation:');
    console.log(`  - Name extracted: ${hasName ? 'yes' : 'no'} (${parsedResume.contactInfo?.name || 'null'})`);
    console.log(`  - Jobs extracted: ${hasJobs ? 'yes' : 'no'} (${parsedResume.experience?.jobs?.length || 0} jobs)`);
    console.log(`  - Skills extracted: ${hasSkills ? 'yes' : 'no'} (${parsedResume.skills?.groups?.length || 0} groups)`);
    console.log(`  - Summary extracted: ${hasSummary ? 'yes' : 'no'} (${parsedResume.summary?.content?.length || 0} chars)`);
    
    if (!hasName && !hasJobs && !hasSkills) {
      console.error('OpenAI returned empty structure. Raw response:', JSON.stringify(parsedResume, null, 2));
      throw new Error('OpenAI parsing failed - all fields empty');
    }
    
    console.log('Resume parsed successfully with actual data');
    
    return parsedResume;
    
  } catch (error) {
    console.error('Resume parsing error:', error);
    console.error('Error details:', error instanceof Error ? error.message : 'Unknown');
    
    // Return fallback with actual resume text
    console.warn('Using fallback resume structure with raw text');
    return {
      contactInfo: { 
        name: "PARSING FAILED - SEE RAW TEXT",
        email: null,
        phone: null,
        location: null
      },
      summary: { 
        type: "summary", 
        content: resumeText  // Include FULL text as fallback
      },
      experience: { 
        type: "experience", 
        jobs: [] 
      },
      skills: { 
        type: "skills", 
        groups: [] 
      }
    };
  }
}
