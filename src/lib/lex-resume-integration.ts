// Lex Resume Analysis Integration System
// Connects rigorous scoring with Lex's HR expertise for double review

interface LexResumeAnalysisInput {
  resumeId: string;
  userId: string;
  automatedAnalysis?: any;
  resumeText?: string;
  fileName?: string;
  requestType: 'initial_review' | 'compare_analyses' | 'improvement_session' | 'job_specific_review';
  jobDescription?: string;
  conversationContext?: string[];
}

interface LexAnalysisResult {
  analysisId: string;
  timestamp: string;
  lexAssessment: {
    overallRating: 'exceptional' | 'strong' | 'solid' | 'needs_work' | 'concerning';
    hrManagerPerspective: string;
    keyStrengths: string[];
    criticalWeaknesses: string[];
    marketCompetitiveness: string;
    industrySpecificInsights: string[];
  };
  comparisonWithAutomated: {
    agreementLevel: 'full_agreement' | 'mostly_aligned' | 'some_differences' | 'significant_differences';
    lexDisagreements: string[];
    additionalInsights: string[];
    humanFactorsNotCaptured: string[];
  };
  actionableFeedback: {
    immediateWins: Array<{
      issue: string;
      solution: string;
      timeToFix: string;
      impactLevel: 'high' | 'medium' | 'low';
      lexTip: string;
    }>;
    strategicRecommendations: string[];
    conversationStarters: string[];
  };
  conversationFlow: {
    suggestedQuestions: string[];
    discussionPoints: string[];
    coachingMode: 'tough_love' | 'encouraging' | 'strategic' | 'technical';
  };
}

export class LexResumeIntegrationSystem {
  
  async performLexAnalysis(input: LexResumeAnalysisInput): Promise<LexAnalysisResult> {
    console.log(`🎯 Lex performing HR expert analysis for resume: ${input.fileName}`);
    
    // Get the automated analysis first
    const automatedAnalysis = input.automatedAnalysis || await this.getAutomatedAnalysis(input.resumeId);
    
    // Prepare Lex's analysis prompt with context
    const lexPrompt = this.buildLexAnalysisPrompt(input, automatedAnalysis);
    
    // Call Claude API for Lex's analysis
    const lexResponse = await this.callLexAnalysisAPI(lexPrompt);
    
    // Structure the response for integration
    return this.structureLexResponse(lexResponse, automatedAnalysis, input);
  }
  
  private buildLexAnalysisPrompt(input: LexResumeAnalysisInput, automatedAnalysis: any): string {
    const basePrompt = `You are Lex, an HR specialist and career coach with deep industry experience. You're reviewing a resume and comparing your expert judgment with an automated analysis system.

CONTEXT:
- Resume: ${input.fileName}
- Request Type: ${input.requestType}
- User needs guidance on resume effectiveness and improvements

AUTOMATED ANALYSIS RESULTS:
Score: ${automatedAnalysis?.overallScore || 'N/A'}/100
Key Issues Found:
${automatedAnalysis?.resumeQuotes?.map((q: any, i: number) => `${i+1}. ${q.issue}: "${q.originalText}"`).join('\n') || 'No specific quotes available'}

Category Breakdown:
- Formatting: ${automatedAnalysis?.scoreBreakdown?.formatting?.score || 'N/A'}/${automatedAnalysis?.scoreBreakdown?.formatting?.maxScore || 25}
- Keywords: ${automatedAnalysis?.scoreBreakdown?.keywords?.score || 'N/A'}/${automatedAnalysis?.scoreBreakdown?.keywords?.maxScore || 30}  
- Content: ${automatedAnalysis?.scoreBreakdown?.content?.score || 'N/A'}/${automatedAnalysis?.scoreBreakdown?.content?.maxScore || 25}
- ATS: ${automatedAnalysis?.scoreBreakdown?.atsCompatibility?.score || 'N/A'}/${automatedAnalysis?.scoreBreakdown?.atsCompatibility?.maxScore || 20}

RESUME TEXT:
${input.resumeText || 'Resume text not available for detailed review'}

YOUR TASK:
As an HR expert, perform your own independent analysis. Consider:

1. **HR Manager First Impression** - What would an HR manager think in 6 seconds?
2. **Market Competitiveness** - How does this compare to other candidates?
3. **Industry Standards** - Does this meet professional expectations?
4. **Hidden Issues** - What might automated analysis miss?
5. **Cultural Fit Indicators** - How does writing style/tone come across?

${this.getRequestSpecificPrompt(input.requestType, input.jobDescription)}

RESPONSE FORMAT:
Provide a JSON response with your analysis structured for our integration system.`;

    return basePrompt;
  }
  
  private getRequestSpecificPrompt(requestType: string, jobDescription?: string): string {
    switch (requestType) {
      case 'initial_review':
        return `
FOCUS: First-time comprehensive review
- Give honest initial assessment
- Compare your judgment with automated scoring
- Identify what automation might have missed
- Suggest conversation topics for coaching session`;

      case 'compare_analyses':
        return `
FOCUS: Compare your analysis with automated results
- Where do you agree/disagree with the automated scoring?
- What human insights does automation miss?
- How would you score this resume differently?
- What additional red flags or strengths do you see?`;

      case 'improvement_session':
        return `
FOCUS: Actionable improvement coaching
- Prioritize the most impactful changes
- Give specific rewrite suggestions
- Share insider HR knowledge about what works
- Create coaching conversation flow`;

      case 'job_specific_review':
        return `
FOCUS: Job-specific resume tailoring review
JOB DESCRIPTION: ${jobDescription || 'Not provided'}
- How well does resume match this specific role?
- What job-specific improvements are needed?
- ATS optimization for this company/role
- Strategic positioning advice`;

      default:
        return 'FOCUS: General resume effectiveness review';
    }
  }
  
  private async callLexAnalysisAPI(prompt: string): Promise<any> {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        })
      });

      const data = await response.json();
      return data.content[0].text;
    } catch (error) {
      console.error('Lex analysis API call failed:', error);
      return this.getFallbackLexResponse();
    }
  }
  
  private getFallbackLexResponse(): string {
    return JSON.stringify({
      lexAssessment: {
        overallRating: 'needs_work',
        hrManagerPerspective: 'Unable to perform detailed analysis at this time, but I can still help you improve this resume.',
        keyStrengths: ['Will analyze in our conversation'],
        criticalWeaknesses: ['Let\'s discuss specific areas for improvement'],
        marketCompetitiveness: 'Needs review',
        industrySpecificInsights: ['We\'ll cover this together']
      },
      comparisonWithAutomated: {
        agreementLevel: 'some_differences',
        lexDisagreements: ['Technical analysis available, human review needed'],
        additionalInsights: ['Personal coaching will provide deeper insights'],
        humanFactorsNotCaptured: ['Tone, personality, cultural fit indicators']
      },
      actionableFeedback: {
        immediateWins: [{
          issue: 'Analysis needed',
          solution: 'Let\'s work through this together',
          timeToFix: '30 minutes',
          impactLevel: 'high',
          lexTip: 'I\'ll help you prioritize the most important changes'
        }],
        strategicRecommendations: ['Start with conversation to identify key areas'],
        conversationStarters: ['Let me ask you about your target role and industry']
      }
    });
  }
  
  private structureLexResponse(lexResponse: string, automatedAnalysis: any, input: LexResumeAnalysisInput): LexAnalysisResult {
    let parsedResponse;
    
    try {
      // Try to extract JSON from Lex's response
      const jsonMatch = lexResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        // Parse unstructured response
        parsedResponse = this.parseUnstructuredLexResponse(lexResponse);
      }
    } catch (error) {
      console.error('Failed to parse Lex response:', error);
      parsedResponse = JSON.parse(this.getFallbackLexResponse());
    }
    
    return {
      analysisId: `lex-${Date.now()}`,
      timestamp: new Date().toISOString(),
      lexAssessment: parsedResponse.lexAssessment || {
        overallRating: 'needs_work',
        hrManagerPerspective: 'Let me help you improve this resume through our conversation.',
        keyStrengths: ['We\'ll identify these together'],
        criticalWeaknesses: ['Let\'s discuss the key areas'],
        marketCompetitiveness: 'Needs improvement',
        industrySpecificInsights: ['I\'ll share relevant insights based on your field']
      },
      comparisonWithAutomated: parsedResponse.comparisonWithAutomated || {
        agreementLevel: 'mostly_aligned',
        lexDisagreements: ['I\'ll share where I see things differently'],
        additionalInsights: ['Human factors and industry context'],
        humanFactorsNotCaptured: ['Personality, cultural fit, growth potential indicators']
      },
      actionableFeedback: parsedResponse.actionableFeedback || {
        immediateWins: [{
          issue: 'Multiple areas need attention',
          solution: 'Let\'s prioritize the highest-impact changes',
          timeToFix: '1-2 hours',
          impactLevel: 'high' as const,
          lexTip: 'I\'ll help you tackle these systematically'
        }],
        strategicRecommendations: ['Start with our conversation to create a tailored action plan'],
        conversationStarters: ['What type of roles are you targeting?', 'What industry are you in?']
      },
      conversationFlow: {
        suggestedQuestions: [
          'What did you think about the automated analysis?',
          'Which issues surprised you the most?',
          'What roles are you applying for?',
          'What\'s your biggest concern about your resume?'
        ],
        discussionPoints: [
          'Comparison of automated vs. human analysis',
          'Industry-specific recommendations',
          'Priority order for improvements',
          'Strategic positioning for target roles'
        ],
        coachingMode: this.determineCoachingMode(automatedAnalysis?.overallScore || 50)
      }
    };
  }
  
  private parseUnstructuredLexResponse(response: string): any {
    // Basic parsing of unstructured Lex response
    const lines = response.split('\n').filter(line => line.trim());
    
    return {
      lexAssessment: {
        overallRating: this.extractRating(response),
        hrManagerPerspective: this.extractFirstImpression(response),
        keyStrengths: this.extractStrengths(response),
        criticalWeaknesses: this.extractWeaknesses(response),
        marketCompetitiveness: 'Discussed in conversation',
        industrySpecificInsights: ['Will provide based on your specific industry']
      }
    };
  }
  
  private extractRating(response: string): string {
    if (/excellent|outstanding|exceptional/i.test(response)) return 'exceptional';
    if (/strong|good|solid/i.test(response)) return 'strong';
    if (/average|okay|decent/i.test(response)) return 'solid';
    if (/weak|poor|needs work|concerning/i.test(response)) return 'needs_work';
    return 'concerning';
  }
  
  private extractFirstImpression(response: string): string {
    const sentences = response.split(/[.!?]+/);
    return sentences.find(s => s.length > 20 && s.length < 150) || 'Let me share my assessment in our conversation.';
  }
  
  private extractStrengths(response: string): string[] {
    const strengthIndicators = response.match(/strength|good|positive|well|effective/gi) || [];
    return strengthIndicators.length > 0 ? ['I see several positive elements we can build on'] : ['We\'ll identify strengths together'];
  }
  
  private extractWeaknesses(response: string): string[] {
    const weaknessIndicators = response.match(/weak|poor|lacking|missing|needs|improve/gi) || [];
    return weaknessIndicators.length > 0 ? ['Multiple areas need strategic improvement'] : ['Let\'s identify key areas for enhancement'];
  }
  
  private determineCoachingMode(score: number): 'tough_love' | 'encouraging' | 'strategic' | 'technical' {
    if (score < 45) return 'tough_love'; // Serious intervention needed
    if (score < 65) return 'encouraging'; // Build confidence while improving
    if (score < 80) return 'strategic'; // Fine-tuning and optimization
    return 'technical'; // Advanced polish and positioning
  }
  
  // Public method to get automated analysis
  private async getAutomatedAnalysis(resumeId: string): Promise<any> {
    try {
      const response = await fetch(`/api/resumes/analysis/${resumeId}`);
      const data = await response.json();
      return data.analysis;
    } catch (error) {
      console.error('Failed to get automated analysis:', error);
      return null;
    }
  }
  
  // Generate conversation starters based on analysis comparison
  generateConversationStarters(lexResult: LexAnalysisResult): string[] {
    const starters: string[] = [];
    
    // Based on agreement level
    switch (lexResult.comparisonWithAutomated.agreementLevel) {
      case 'full_agreement':
        starters.push("The automated analysis and my assessment are pretty aligned - let's dig into the specifics together.");
        break;
      case 'mostly_aligned':
        starters.push("I mostly agree with the automated analysis, but I have some additional insights to share.");
        break;
      case 'some_differences':
        starters.push("Interesting - the automated analysis caught some things, but I see a few additional areas we should discuss.");
        break;
      case 'significant_differences':
        starters.push("I have a pretty different take on your resume than the automated system. Let me share my HR perspective.");
        break;
    }
    
    // Based on overall rating
    switch (lexResult.lexAssessment.overallRating) {
      case 'exceptional':
        starters.push("Your resume is actually quite strong! Let's talk about positioning it for your dream roles.");
        break;
      case 'strong':
        starters.push("You've got a solid foundation here. Let's make some strategic improvements to make you stand out.");
        break;
      case 'solid':
        starters.push("There's definitely potential here. I have some specific ideas on how to make this more compelling.");
        break;
      case 'needs_work':
        starters.push("Let's be honest - this needs some work, but I know exactly how to fix it. Are you ready for some real talk?");
        break;
      case 'concerning':
        starters.push("Okay, we need to have a serious conversation about positioning you competitively. But don't worry - I've helped people turn this around before.");
        break;
    }
    
    return starters;
  }
  
  // Generate specific discussion prompts for Lex
  generateLexDiscussionPrompts(lexResult: LexAnalysisResult, automatedAnalysis: any): string[] {
    return [
      `The automated system gave you ${automatedAnalysis?.overallScore || 'a score'}/100. From my HR experience, I'd rate this as '${lexResult.lexAssessment.overallRating}' - here's why...`,
      
      `What the automated analysis missed: ${lexResult.comparisonWithAutomated.humanFactorsNotCaptured.join(', ')}`,
      
      `My biggest concern as an HR manager: ${lexResult.lexAssessment.criticalWeaknesses[0] || 'Let me explain what stands out to me...'}`,
      
      `The good news: ${lexResult.lexAssessment.keyStrengths.join(' and ')}`,
      
      `If I were screening this resume, here's what I'd think: ${lexResult.lexAssessment.hrManagerPerspective}`,
      
      `Priority fixes that will have the biggest impact: ${lexResult.actionableFeedback.immediateWins.map(w => w.issue).join(', ')}`,
      
      `Industry insight: ${lexResult.lexAssessment.industrySpecificInsights[0] || 'Let me share what I know about your field...'}`
    ];
  }
}

export default LexResumeIntegrationSystem;