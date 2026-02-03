// Enhanced Lex Conversation System with Resume Analysis Integration
// Handles double review conversations, comparing automated and HR expert analysis

interface LexConversationContext {
  userId?: string;
  conversationId?: string;
  currentResume?: {
    id: string;
    fileName: string;
    automatedAnalysis?: any;
    lexAnalysis?: any;
  };
  conversationMode: 'initial_review' | 'double_review' | 'improvement_session' | 'job_specific' | 'general_chat';
  userGoals?: string[];
  previousMessages?: Array<{ role: string; content: string; timestamp: string }>;
}

export class EnhancedLexConversationSystem {
  
  async processResumeAnalysisConversation(
    userMessage: string, 
    context: LexConversationContext
  ): Promise<{ response: string; suggestedActions: string[]; nextQuestions: string[] }> {
    
    if (!context.currentResume && context.userId) {
      context.currentResume = await this.getCurrentResumeContext(context.userId);
    }
    
    const conversationFlow = this.determineConversationFlow(userMessage, context);
    const lexResponse = await this.generateLexResponse(userMessage, context, conversationFlow);
    const suggestedActions = this.extractActionableSuggestions(lexResponse, context);
    const nextQuestions = this.generateFollowUpQuestions(conversationFlow, context);
    
    return {
      response: lexResponse,
      suggestedActions,
      nextQuestions
    };
  }
  
  private async getCurrentResumeContext(userId: string): Promise<any> {
    try {
      const response = await fetch("/api/lex/resume-context");
      const data = await response.json();
      return data.resumeContext?.masterResume || data.resumeContext?.currentResume;
    } catch (error) {
      console.error('Failed to get resume context:', error);
      return null;
    }
  }
  
  private determineConversationFlow(userMessage: string, context: LexConversationContext): string {
    const message = userMessage.toLowerCase();
    
    if (message.includes('resume') || message.includes('analysis') || message.includes('score')) {
      if (message.includes('disagree') || message.includes('different') || message.includes('wrong')) {
        return 'analysis_disagreement';
      }
      if (message.includes('improve') || message.includes('fix') || message.includes('better')) {
        return 'improvement_focused';
      }
      if (message.includes('compare') || message.includes('automated') || message.includes('system')) {
        return 'double_review_discussion';
      }
      return 'resume_analysis_general';
    }
    
    if (message.includes('job') || message.includes('application') || message.includes('interview')) {
      return 'job_specific_guidance';
    }
    
    if (message.includes('career') || message.includes('goals') || message.includes('strategy')) {
      return 'career_strategy';
    }
    
    return 'general_career_chat';
  }
  
  private async generateLexResponse(
    userMessage: string, 
    context: LexConversationContext,
    conversationFlow: string
  ): Promise<string> {
    
    const systemPrompt = this.buildLexSystemPrompt(context, conversationFlow);
    const conversationHistory = this.buildConversationHistory(context);
    
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 4000,
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            ...conversationHistory,
            {
              role: 'user', 
              content: userMessage
            }
          ]
        })
      });

      const data = await response.json();
      return data.content[0].text;
    } catch (error) {
      console.error('Lex API call failed:', error);
      return this.getFallbackResponse(conversationFlow);
    }
  }
  
  private buildLexSystemPrompt(context: LexConversationContext, conversationFlow: string): string {
    const basePersonality = `You are Lex, an HR specialist and career coach. You're direct, insightful, and genuinely care about helping people succeed. You draw from real HR experience and aren't afraid to give honest feedback.`;
    
    const resumeContext = context.currentResume ? `
CURRENT RESUME CONTEXT:
- Resume: ${context.currentResume.fileName}
- Automated Analysis Score: ${context.currentResume.automatedAnalysis?.overallScore || 'Not available'}/100
- Key Issues Found: ${context.currentResume.automatedAnalysis?.resumeQuotes?.length || 0} specific examples
- Lex Analysis Available: ${context.currentResume.lexAnalysis ? 'Yes' : 'No'}
` : '';

    const flowSpecificInstructions = this.getFlowSpecificInstructions(conversationFlow);
    
    return `${basePersonality}\n\n${resumeContext}\n\n${flowSpecificInstructions}`;
  }
  
  private getFlowSpecificInstructions(flow: string): string {
    const instructions: Record<string, string> = {
      'analysis_disagreement': `FOCUS: User disagrees with analysis results. Listen first, then explain HR perspective.`,
      'improvement_focused': `FOCUS: User wants to improve. Give specific, actionable rewrite examples.`,
      'double_review_discussion': `FOCUS: Comparing automated vs human analysis. Share HR insights systems miss.`,
      'job_specific_guidance': `FOCUS: Job application strategy. Help tailor approach to specific positions.`,
      'career_strategy': `FOCUS: Broader career planning. Connect improvements to strategic positioning.`,
      'general_career_chat': `FOCUS: General guidance. Be helpful and reference resume context when relevant.`
    };
    return instructions[flow] || instructions['general_career_chat'];
  }
  
  private buildConversationHistory(context: LexConversationContext): any[] {
    if (!context.previousMessages || context.previousMessages.length === 0) {
      return [];
    }
    return context.previousMessages.slice(-6).map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content
    }));
  }
  
  private getFallbackResponse(flow: string): string {
    const fallbacks: Record<string, string> = {
      'analysis_disagreement': "I hear you. Let's talk through what you're seeing differently.",
      'improvement_focused': "Let's make this resume work harder for you. What's your priority?",
      'double_review_discussion': "The automated system catches technical issues, but I notice things as an HR person it misses.",
      'job_specific_guidance': "Tell me about the role you're targeting.",
      'career_strategy': "What's your current situation and where are you trying to get to?",
      'general_career_chat': "I'm here to help with any career questions. What's on your mind?"
    };
    return fallbacks[flow] || fallbacks['general_career_chat'];
  }
  
  private extractActionableSuggestions(response: string, context: LexConversationContext): string[] {
    const suggestions: string[] = [];
    const sentences = response.split(/[.!?]+/).filter(s => s.length > 20);
    const actionWords = ['start with', 'try', 'change', 'add', 'remove', 'replace', 'focus on', 'consider'];
    
    sentences.forEach(sentence => {
      if (actionWords.some(word => sentence.toLowerCase().includes(word))) {
        suggestions.push(sentence.trim());
      }
    });
    
    return suggestions.slice(0, 3);
  }
  
  private generateFollowUpQuestions(flow: string, context: LexConversationContext): string[] {
    const questions: Record<string, string[]> = {
      'analysis_disagreement': ["Which part felt off?", "What's your resume's strongest point?"],
      'improvement_focused': ["What roles are you targeting?", "What's your timeline?"],
      'double_review_discussion': ["Want to know what I see differently?", "Should we go through issues one by one?"],
      'job_specific_guidance': ["Can you share the job description?", "What stage are you at?"],
      'career_strategy': ["What's your ideal role in 2-3 years?", "What's your biggest challenge?"],
      'general_career_chat': ["What's your biggest career priority?", "Want to dive into your resume?"]
    };
    return questions[flow] || questions['general_career_chat'];
  }
  
  async startResumeAnalysisConversation(
    userId: string,
    resumeId: string,
    analysisType: 'initial' | 'comparison' | 'improvement' = 'comparison'
  ): Promise<{ openingMessage: string; context: LexConversationContext }> {
    
    const context: LexConversationContext = {
      userId,
      currentResume: {
        id: resumeId,
        fileName: 'Resume',
      },
      conversationMode: 'double_review'
    };
    
    const openingMessages = {
      'initial': "I just finished reviewing your resume. What questions do you have about the analysis?",
      'comparison': "I see things a bit differently than the automated system on your resume. Want to dive into the specifics?",
      'improvement': "Let's get your resume working harder for you. Which area do you want to focus on first?"
    };
    
    return {
      openingMessage: openingMessages[analysisType],
      context
    };
  }
}

export default EnhancedLexConversationSystem;
