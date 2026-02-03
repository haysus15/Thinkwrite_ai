// Tailored Resume Engine - HONEST VERSION
// src/lib/tailored-resume-engine.ts
// Dual AI approach: OpenAI for structured analysis, Claude for Lex HR perspective

import type {
  TailoringLevel,
  ResumeChange,
  StructuredResumeContent,
  LexCommentary,
  ChangeImpact,
  ResumeSection
} from '@/types/tailored-resume';

interface TailoringInput {
  masterResumeText: string;
  masterResumeStructured?: StructuredResumeContent;
  voiceSystemPrompt?: string;
  jobAnalysis: {
    jobTitle: string;
    company: string;
    description: string;
    requirements: string[];
    responsibilities: string[];
    atsKeywords: {
      hardSkills: string[];
      softSkills: string[];
      technologies: string[];
      experienceKeywords: string[];
    };
    hiddenInsights?: any;
  };
  tailoringLevel: TailoringLevel;
}

interface TailoringResult {
  success: boolean;
  originalContent: StructuredResumeContent;
  tailoredContent: StructuredResumeContent;
  changes: ResumeChange[];
  lexCommentary: LexCommentary;
  gaps?: Array<{ requirement: string; gap: string; recommendation: string }>;
  error?: string;
}

export class TailoredResumeEngine {
  
  async generateTailoredResume(input: TailoringInput): Promise<TailoringResult> {
    console.log('🎯 Starting HONEST resume tailoring process...');
    console.log(`📊 Tailoring level: ${input.tailoringLevel}`);
    console.log(`🏢 Target: ${input.jobAnalysis.jobTitle} at ${input.jobAnalysis.company}`);
    
    try {
      // Step 1: Parse resume into structured format (if not already)
      const originalContent = input.masterResumeStructured || 
        await this.parseResumeToStructured(input.masterResumeText);
      
      console.log('✅ Resume parsed into structured format');
      
      // Step 2: Run OpenAI analysis for keyword mapping and structural changes
      const openAIAnalysis = await this.runOpenAITailoring(
        originalContent,
        input.jobAnalysis,
        input.tailoringLevel
      );
      
      console.log('✅ OpenAI tailoring analysis complete');
      console.log(`📋 Generated ${openAIAnalysis.changes.length} changes`);
      console.log(`⚠️ Identified ${openAIAnalysis.gaps?.length || 0} honest gaps`);
      
      // Step 3: Run Claude/Lex for HR perspective and HONESTY CHECK
      const lexAnalysis = await this.runLexReview(
        originalContent,
        openAIAnalysis,
        input.jobAnalysis,
        input.tailoringLevel,
        input.voiceSystemPrompt
      );
      
      console.log('✅ Lex HR review complete');
      
      // Step 4: Merge and finalize changes
      const mergedResult = this.mergeAnalyses(originalContent, openAIAnalysis, lexAnalysis);
      
      console.log(`✅ Final: ${mergedResult.changes.length} changes (honesty-checked)`);
      
      return {
        success: true,
        originalContent,
        tailoredContent: mergedResult.tailoredContent,
        changes: mergedResult.changes,
        lexCommentary: mergedResult.lexCommentary,
        gaps: openAIAnalysis.gaps
      };
      
    } catch (error) {
      console.error('❌ Tailoring failed:', error);
      return {
        success: false,
        originalContent: {} as StructuredResumeContent,
        tailoredContent: {} as StructuredResumeContent,
        changes: [],
        lexCommentary: {} as LexCommentary,
        error: error instanceof Error ? error.message : 'Tailoring failed'
      };
    }
  }
  
  // Parse raw resume text into structured format
  private async parseResumeToStructured(resumeText: string): Promise<StructuredResumeContent> {
    const prompt = `Parse this resume into a structured JSON format. Extract all sections accurately.

RESUME TEXT:
${resumeText}

Return a JSON object with this structure:
{
  "contactInfo": {
    "name": "string",
    "email": "string or null",
    "phone": "string or null",
    "location": "string or null",
    "linkedin": "string or null",
    "website": "string or null"
  },
  "summary": {
    "type": "summary",
    "content": "string - the full summary/objective text"
  },
  "experience": {
    "type": "experience",
    "jobs": [
      {
        "id": "job-1",
        "title": "string",
        "company": "string",
        "location": "string or null",
        "startDate": "string",
        "endDate": "string or null",
        "current": boolean,
        "bullets": [
          { "id": "job-1-bullet-1", "content": "string" }
        ]
      }
    ]
  },
  "skills": {
    "type": "skills",
    "groups": [
      {
        "id": "skill-group-1",
        "category": "string (e.g., Technical Skills, Languages)",
        "skills": ["skill1", "skill2"]
      }
    ]
  },
  "education": {
    "type": "education",
    "entries": [
      {
        "id": "edu-1",
        "degree": "string",
        "institution": "string",
        "location": "string or null",
        "graduationDate": "string or null",
        "gpa": "string or null",
        "honors": ["string"] or null,
        "relevantCoursework": ["string"] or null
      }
    ]
  },
  "certifications": {
    "type": "certifications",
    "entries": [
      {
        "id": "cert-1",
        "name": "string",
        "issuer": "string",
        "date": "string or null"
      }
    ]
  },
  "projects": {
    "type": "projects",
    "entries": [
      {
        "id": "proj-1",
        "name": "string",
        "description": "string",
        "technologies": ["string"] or null,
        "bullets": [{ "id": "proj-1-bullet-1", "content": "string" }] or null
      }
    ]
  }
}

Only include sections that exist in the resume. Return ONLY valid JSON, no markdown.`;

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
          max_tokens: 4000
        })
      });

      const data = await response.json();
      const content = data.choices[0]?.message?.content || '{}';
      
      // Clean and parse JSON
      const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(cleanedContent);
      
    } catch (error) {
      console.error('Resume parsing error:', error);
      throw new Error('Failed to parse resume structure');
    }
  }
  
  // OpenAI: Structural analysis and keyword-focused tailoring (HONEST VERSION)
  private async runOpenAITailoring(
    originalContent: StructuredResumeContent,
    jobAnalysis: TailoringInput['jobAnalysis'],
    level: TailoringLevel
  ): Promise<{ 
    changes: ResumeChange[]; 
    tailoredContent: StructuredResumeContent;
    gaps?: Array<{ requirement: string; gap: string; recommendation: string }>;
  }> {
    
    const levelInstructions = {
      light: `LIGHT TAILORING - Keyword optimization only:
- Add 2-3 relevant keywords ONLY if they describe existing work
- Minor phrasing tweaks for clarity (never change meaning)
- Example: "Managed shipments" → "Managed customs shipments" (if they did customs work)
- DO NOT add skills/experience they don't have
- Target 5-10 changes`,
      
      medium: `MEDIUM TAILORING - Strategic reframing:
- Rewrite bullets to EMPHASIZE relevant aspects of existing work
- Example: "Used various software" → "Used trade compliance software including ACE/AES" (if true)
- Use stronger action verbs ONLY if they accurately describe what was done
- DO NOT claim specific tools/technologies they haven't used
- If they lack a requirement, SKIP IT - don't fabricate
- Target 10-20 changes`,
      
      heavy: `HEAVY TAILORING - Comprehensive restructure:
- Reorder content to lead with most relevant experience
- Expand detail on relevant experience (but only if they actually did it)
- Minimize irrelevant content
- Example: If they advised brokers, say "Advised brokers on entry processing" NOT "Processed entries"
- NEVER claim certifications, degrees, or specific experience they lack
- Flag gaps honestly - don't cover them up
- Target 20+ changes`
    };
    
    const prompt = `You are an HONEST resume optimizer. Your job is to help candidates present their REAL experience effectively, never to fabricate.

TARGET JOB:
Title: ${jobAnalysis.jobTitle}
Company: ${jobAnalysis.company}
Requirements: ${jobAnalysis.requirements.slice(0, 10).join(', ')}
Responsibilities: ${jobAnalysis.responsibilities.slice(0, 10).join(', ')}

ATS KEYWORDS TO INCORPORATE (ONLY IF APPLICABLE):
Hard Skills: ${jobAnalysis.atsKeywords.hardSkills.join(', ')}
Soft Skills: ${jobAnalysis.atsKeywords.softSkills.join(', ')}
Technologies: ${jobAnalysis.atsKeywords.technologies.join(', ')}
Experience Keywords: ${jobAnalysis.atsKeywords.experienceKeywords.join(', ')}

ORIGINAL RESUME:
${JSON.stringify(originalContent, null, 2)}

${levelInstructions[level]}

CRITICAL HONESTY RULES:
1. ✅ GOOD: "Managed compliance documentation" → "Managed customs compliance documentation" (if they did customs work)
2. ❌ BAD: "Advised on CargoWise" → "Implemented CargoWise" (don't upgrade advisory to hands-on)
3. ✅ GOOD: "Used multiple software systems" → "Used ACE and AES systems for trade compliance" (if true)
4. ❌ BAD: Add "CargoWise" to skills if they only have ACE/AES
5. ✅ GOOD: Reorder bullets to lead with relevant experience
6. ❌ BAD: Change 2 years experience to 4 years
7. ✅ GOOD: "Supported brokers with entry processing" (if they advised)
8. ❌ BAD: "Processed 500+ entries daily" (if they only advised)

FOR EACH CHANGE:
- Ask: "Is this change 100% truthful based on their actual experience?"
- If no → SKIP IT or FLAG IT as requiring conversation
- If yes → Include it

FLAGGING SYSTEM:
If a change would be HELPFUL but REQUIRES MORE INFO, set "requiresConversation": true
Example: Job wants "CargoWise experience". Resume has "Trade compliance software". 
→ FLAG: "Need to clarify if their software experience includes CargoWise"

GAP IDENTIFICATION:
Honestly identify what the candidate LACKS that the job REQUIRES.
Don't try to paper over gaps - flag them for strategic conversation.

Return JSON:
{
  "changes": [
    {
      "id": "uuid",
      "section": "experience|skills|summary|education|projects",
      "subsection": "specific location like job-1-bullet-2",
      "original": "exact original text",
      "tailored": "improved text",
      "reason": "brief explanation of why this change helps",
      "impact": "high|medium|low",
      "keywords": ["keywords", "this", "addresses"],
      "requiresConversation": false,
      "conversationQuestion": ""
    }
  ],
  "gaps": [
    {
      "requirement": "what the job needs",
      "gap": "what candidate lacks or is unclear about",
      "recommendation": "suggest discussing with Lex to address strategically"
    }
  ],
  "tailoredContent": {
    // Full restructured resume with all changes applied
  }
}

REMEMBER: It's better to have honest gaps than dishonest claims. Lex can help address gaps strategically through conversation.

Return ONLY valid JSON.`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 8000
        })
      });

      const data = await response.json();
      const content = data.choices[0]?.message?.content || '{}';
      const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
      const result = JSON.parse(cleanedContent);
      
      // Add default status to all changes
      result.changes = result.changes.map((change: any) => ({
        ...change,
        status: 'pending',
        lexTip: '',
        honestyFlag: 'PENDING' // Will be set by Lex review
      }));
      
      return result;
      
    } catch (error) {
      console.error('OpenAI tailoring error:', error);
      throw new Error('Failed to generate tailored content');
    }
  }
  
  // Claude/Lex: HR perspective and HONESTY CHECK
  private async runLexReview(
    originalContent: StructuredResumeContent,
    openAIAnalysis: { 
      changes: ResumeChange[]; 
      tailoredContent: StructuredResumeContent;
      gaps?: Array<{ requirement: string; gap: string; recommendation: string }>;
    },
    jobAnalysis: TailoringInput['jobAnalysis'],
    level: TailoringLevel,
    voiceSystemPrompt?: string
  ): Promise<{ 
    lexCommentary: LexCommentary; 
    refinedChanges: Array<{ 
      id: string; 
      lexTip: string; 
      approved: boolean; 
      honestyFlag: 'SAFE' | 'QUESTIONABLE' | 'DISHONEST';
      refinedTailored?: string;
    }> 
  }> {
    
    const prompt = `You are Lex, an HR specialist who values HONESTY above all else. You're reviewing resume tailoring suggestions.

JOB TARGET:
${jobAnalysis.jobTitle} at ${jobAnalysis.company}

ORIGINAL RESUME SUMMARY:
${originalContent.summary?.content || 'No summary provided'}

EXPERIENCE SUMMARY:
${JSON.stringify(originalContent.experience?.jobs?.slice(0, 3).map(j => ({
  title: j.title,
  company: j.company,
  bullets: j.bullets?.slice(0, 2).map(b => b.content)
})), null, 2)}

PROPOSED CHANGES (${openAIAnalysis.changes.length} total):
${JSON.stringify(openAIAnalysis.changes, null, 2)}

IDENTIFIED GAPS:
${JSON.stringify(openAIAnalysis.gaps || [], null, 2)}

YOUR TASK - BE BRUTALLY HONEST:
1. Review each change for HONESTY - this is your PRIMARY job
2. Flag any change that:
   - Adds skills/experience they don't have
   - Upgrades advisory work to hands-on
   - Exaggerates scope or responsibility
   - Claims specific tools/certifications without evidence

HONESTY LEVELS:
- SAFE: Accurate reframing of real experience ✅
- QUESTIONABLE: Might be pushing it, needs conversation 🤔  
- DISHONEST: This is fabrication, REJECT ❌

HONESTY EXAMPLES:
✅ SAFE: "Managed compliance tasks" → "Managed customs compliance tasks" (if they did customs)
✅ SAFE: "Worked with team" → "Collaborated with cross-functional team" (accurate reframing)
🤔 QUESTIONABLE: "Used software systems" → "Used CargoWise One" (needs verification - do they actually use it?)
🤔 QUESTIONABLE: "Provided guidance" → "Trained team members" (was it actual training or just advice?)
❌ DISHONEST: "Advised brokers" → "Processed 500+ customs entries daily" (advisory ≠ processing)
❌ DISHONEST: Adding "Licensed Customs Broker" when they're studying for exam

FOR QUESTIONABLE CHANGES:
Suggest: "Let's discuss: Do you actually have experience with [specific tool/skill]?"
Or: "This needs conversation - were you actually [doing X] or [advising on X]?"

CONVERSATION RECOMMENDATION:
If you find 3+ QUESTIONABLE changes OR any DISHONEST changes, recommend a strategy session with you before proceeding.

Return JSON:
{
  "lexCommentary": {
    "overallAssessment": "Your honest take on these suggestions",
    "honestyReport": "How honest are these changes? Any red flags?",
    "recommendConversation": true/false,
    "conversationTopics": ["Specific topics that need discussion"],
    "tailoringStrategy": "What approach you'd recommend for this specific job",
    "keyImprovements": ["Top 3-5 most impactful SAFE changes to prioritize"],
    "honestFeedback": "What they might actually need to develop/learn if they have gaps",
    "interviewTips": ["How to talk about these changes in interviews without lying"]
  },
  "refinedChanges": [
    {
      "id": "same-id-as-input",
      "lexTip": "Your specific advice for this change",
      "approved": true/false,
      "honestyFlag": "SAFE|QUESTIONABLE|DISHONEST",
      "refinedTailored": "your improved version if you'd tweak it"
    }
  ]
}

Be the HR person you are - direct, honest, helpful. Don't let them shoot themselves in the foot with lies. If something feels off, call it out. Better to have an honest conversation than a dishonest resume.

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
          system: voiceSystemPrompt,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      const data = await response.json();
      const content = data.content[0]?.text || '{}';
      const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(cleanedContent);
      
    } catch (error) {
      console.error('Lex review error:', error);
      // Return safe default if Lex review fails
      return {
        lexCommentary: {
          overallAssessment: "I've reviewed the suggested changes. They look reasonable for this role.",
          honestyReport: "Unable to complete full honesty check - please review each change carefully.",
          recommendConversation: true, // Play it safe
          conversationTopics: ["Review each change to ensure it accurately reflects your experience"],
          tailoringStrategy: "Focus on the highest-impact changes first.",
          keyImprovements: ["Review each change carefully before accepting"],
          honestFeedback: "Make sure all changes accurately reflect your actual experience.",
          interviewTips: ["Be prepared to discuss any changes you make"],
          perChangeComments: {}
        },
        refinedChanges: openAIAnalysis.changes.map(c => ({
          id: c.id,
          lexTip: "Review this change and decide if it accurately represents your experience.",
          approved: true,
          honestyFlag: 'QUESTIONABLE' as const // Mark all as questionable if review failed
        }))
      };
    }
  }
  
  // Merge OpenAI and Lex analyses into final result
  private mergeAnalyses(
    originalContent: StructuredResumeContent,
    openAIAnalysis: { 
      changes: ResumeChange[]; 
      tailoredContent: StructuredResumeContent;
      gaps?: Array<{ requirement: string; gap: string; recommendation: string }>;
    },
    lexAnalysis: { 
      lexCommentary: LexCommentary; 
      refinedChanges: Array<{ 
        id: string; 
        lexTip: string; 
        approved: boolean; 
        honestyFlag: 'SAFE' | 'QUESTIONABLE' | 'DISHONEST';
        refinedTailored?: string;
      }> 
    }
  ): {
    tailoredContent: StructuredResumeContent;
    changes: ResumeChange[];
    lexCommentary: LexCommentary;
  } {
    
    // Merge Lex's tips and honesty flags into the changes
    const mergedChanges = openAIAnalysis.changes.map(change => {
      const lexRefine = lexAnalysis.refinedChanges.find(r => r.id === change.id);
      return {
        ...change,
        lexTip: lexRefine?.lexTip || change.lexTip || '',
        tailored: lexRefine?.refinedTailored || change.tailored,
        honestyFlag: lexRefine?.honestyFlag || 'SAFE',
        // Auto-reject DISHONEST changes
        status: lexRefine?.honestyFlag === 'DISHONEST' ? 'rejected' : change.status
      };
    });
    
    // Build per-change comments for lexCommentary
    const perChangeComments: Record<string, string> = {};
    mergedChanges.forEach(change => {
      if (change.lexTip) {
        perChangeComments[change.id] = change.lexTip;
      }
    });
    
    return {
      tailoredContent: openAIAnalysis.tailoredContent,
      changes: mergedChanges,
      lexCommentary: {
        ...lexAnalysis.lexCommentary,
        perChangeComments
      }
    };
  }
  
  // Apply accepted changes to generate final content
  applyAcceptedChanges(
    originalContent: StructuredResumeContent,
    changes: ResumeChange[]
  ): StructuredResumeContent {
    const acceptedChanges = changes.filter(c => c.status === 'accepted');
    
    // Deep clone original
    const result = JSON.parse(JSON.stringify(originalContent));
    
    // Apply each accepted change
    acceptedChanges.forEach(change => {
      this.applyChangeToContent(result, change);
    });
    
    return result;
  }
  
  private applyChangeToContent(content: StructuredResumeContent, change: ResumeChange): void {
    const { section, subsection, tailored } = change;
    
    switch (section) {
      case 'summary':
        if (content.summary) {
          content.summary.content = tailored;
        }
        break;
        
      case 'experience':
        if (content.experience && subsection) {
          const match = subsection.match(/job-(\d+)-bullet-(\d+)/);
          if (match) {
            const jobIndex = parseInt(match[1]) - 1;
            const bulletIndex = parseInt(match[2]) - 1;
            if (content.experience.jobs[jobIndex]?.bullets[bulletIndex]) {
              content.experience.jobs[jobIndex].bullets[bulletIndex].content = tailored;
            }
          }
        }
        break;
        
      case 'skills':
        if (content.skills && subsection) {
          const match = subsection.match(/skill-group-(\d+)/);
          if (match) {
            const groupIndex = parseInt(match[1]) - 1;
            if (content.skills.groups[groupIndex]) {
              content.skills.groups[groupIndex].skills = tailored.split(',').map(s => s.trim());
            }
          }
        }
        break;
        
      case 'education':
        // Similar pattern for education changes
        break;
        
      case 'projects':
        if (content.projects && subsection) {
          const match = subsection.match(/proj-(\d+)-bullet-(\d+)/);
          if (match) {
            const projIndex = parseInt(match[1]) - 1;
            const bulletIndex = parseInt(match[2]) - 1;
            if (content.projects.entries[projIndex]?.bullets?.[bulletIndex]) {
              content.projects.entries[projIndex].bullets![bulletIndex].content = tailored;
            }
          }
        }
        break;
    }
  }
}

export default TailoredResumeEngine;
