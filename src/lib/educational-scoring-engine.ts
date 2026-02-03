// Rigorous, Consistent, Brutally Honest Resume Scoring Engine
// NO GRADE INFLATION - Same input = Same output, every time

interface ResumeAnalysisResult {
  overallScore: number;
  scoreBreakdown: ScoreBreakdown;
  recommendations: ContentSpecificRecommendation[];
  educationalInsights: EducationalInsight[];
  hrPerspective: HRPerspective;
  resumeQuotes: ResumeQuote[];
  consistencyCheck: {
    analysisId: string;
    timestamp: string;
    deterministicScore: boolean;
    scoringCriteria: string;
  };
}

interface ContentSpecificRecommendation {
  priority: 'high' | 'medium' | 'low';
  category: string;
  issue: string;
  solution: string;
  impact: string;
  currentExample?: string;
  improvedExample?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedTimeToFix: string;
}

interface ResumeQuote {
  originalText: string;
  context: string;
  issue: string;
  suggestedImprovement: string;
  category: 'weak_language' | 'missing_metrics' | 'passive_voice' | 'unclear_impact' | 'generic_description';
}

interface ScoreBreakdown {
  formatting: CategoryScore;
  keywords: CategoryScore; 
  content: CategoryScore;
  atsCompatibility: CategoryScore;
}

interface CategoryScore {
  score: number;
  maxScore: number;
  level: 'excellent' | 'good' | 'needs_improvement' | 'poor';
  explanation: string;
  whyItMatters: string;
  specificIssues: string[];
  positivePoints: string[];
  examplesFromResume: string[];
  rigorousAssessment: string;
}

interface EducationalInsight {
  topic: string;
  explanation: string;
  yourExample?: string;
  betterExample?: string;
  lexTip?: string;
}

interface HRPerspective {
  firstImpression: string;
  likelyOutcome: 'will_advance' | 'maybe_advance' | 'unlikely_advance';
  timeToReview: string;
  standoutElements: string[];
  concerningElements: string[];
  overallAssessment: string;
  specificConcerns?: string[];
  brutallyHonestFeedback: string;
}

export class RigorousConsistentScoringEngine {
  
  private readonly SCORING_VERSION = "v2.0-rigorous";
  private readonly WEAK_LANGUAGE_PENALTY = 3; // Points per weak phrase
  private readonly MISSING_METRICS_PENALTY = 5; // Heavy penalty for no metrics
  private readonly GENERIC_DESCRIPTION_PENALTY = 2; // Points per generic phrase
  
  async analyzeResume(resumeText: string, fileName: string): Promise<ResumeAnalysisResult> {
    console.log(`🎯 Starting RIGOROUS analysis (${this.SCORING_VERSION}) for: ${fileName}`);
    
    // Create deterministic analysis ID for consistency tracking
    const analysisId = this.createDeterministicId(resumeText);
    
    const contentAnalysis = this.extractResumeContent(resumeText);
    const resumeQuotes = this.extractQuotesRigorously(resumeText, contentAnalysis);
    
    // RIGOROUS SCORING - No mercy for common mistakes
    const formatting = this.scoreFormattingRigorously(resumeText, fileName, contentAnalysis);
    const keywords = this.scoreKeywordsRigorously(resumeText, contentAnalysis, resumeQuotes);
    const content = this.scoreContentRigorously(resumeText, contentAnalysis, resumeQuotes);
    const atsCompatibility = this.scoreATSRigorously(resumeText, fileName, contentAnalysis);
    
    // NO GRADE INFLATION - Simple addition, harsh criteria
    const overallScore = Math.max(0, formatting.score + keywords.score + content.score + atsCompatibility.score);
    
    const recommendations = this.generateRigorousRecommendations(
      { formatting, keywords, content, atsCompatibility },
      resumeQuotes,
      contentAnalysis
    );
    
    const educationalInsights = this.generateBrutallyHonestInsights(
      { formatting, keywords, content, atsCompatibility },
      contentAnalysis
    );
    
    const hrPerspective = this.generateBrutallyHonestHRPerspective(
      overallScore, 
      { formatting, keywords, content, atsCompatibility },
      resumeQuotes
    );
    
    console.log(`📊 RIGOROUS SCORING COMPLETE: ${overallScore}/100 (${this.getHonestLevel(overallScore)})`);
    console.log(`🔍 Weak language instances: ${resumeQuotes.filter(q => q.category === 'weak_language').length}`);
    console.log(`📈 Missing metrics instances: ${resumeQuotes.filter(q => q.category === 'missing_metrics').length}`);
    
    return {
      overallScore,
      scoreBreakdown: { formatting, keywords, content, atsCompatibility },
      recommendations,
      educationalInsights,
      hrPerspective,
      resumeQuotes,
      consistencyCheck: {
        analysisId,
        timestamp: new Date().toISOString(),
        deterministicScore: true,
        scoringCriteria: this.SCORING_VERSION
      }
    };
  }
  
  private createDeterministicId(resumeText: string): string {
    // Create a deterministic hash of the content for consistency tracking
    let hash = 0;
    for (let i = 0; i < resumeText.length; i++) {
      const char = resumeText.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36) + '-' + this.SCORING_VERSION;
  }
  
  private getHonestLevel(score: number): string {
    if (score >= 85) return 'EXCELLENT';
    if (score >= 75) return 'GOOD';
    if (score >= 60) return 'NEEDS IMPROVEMENT';
    if (score >= 45) return 'POOR';
    return 'TERRIBLE';
  }
  
  private extractResumeContent(resumeText: string) {
    const lines = resumeText.split('\n').filter(line => line.trim().length > 0);
    const sentences = resumeText.split(/[.!?]+/).filter(s => s.trim().length > 10).map(s => s.trim());
    
    const bulletPoints = lines.filter(line => {
      const trimmed = line.trim();
      return /^[\s]*[•\-\*\u2022\u2023\u25E6]/.test(trimmed) || 
             /^[\s]*\d+[\.\)]/.test(trimmed) ||
             /^[\s]*[A-Za-z]\)/.test(trimmed);
    }).map(line => line.replace(/^[\s]*[•\-\*\u2022\u2023\u25E6\d\.\)\w\)]+/, '').trim());
    
    // Rigorous section detection
    const sections: Record<string, string[]> = {
      experience: [],
      education: [],
      skills: [],
      summary: [],
      contact: []
    };
    
    let currentSection = '';
    lines.forEach(line => {
      const lowerLine = line.toLowerCase();
      
      if (/^(professional\s+)?experience|work\s+(history|experience)|employment(\s+history)?/i.test(lowerLine)) {
        currentSection = 'experience';
      } else if (/^education|academic|qualifications|degrees?/i.test(lowerLine)) {
        currentSection = 'education';
      } else if (/^(technical\s+)?skills|competencies|proficiencies/i.test(lowerLine)) {
        currentSection = 'skills';
      } else if (/^(professional\s+)?summary|objective|profile|about/i.test(lowerLine)) {
        currentSection = 'summary';
      } else if (/contact|@|phone|\+\d|\(\d{3}\)/i.test(lowerLine)) {
        currentSection = 'contact';
      } else if (currentSection && line.trim().length > 0) {
        sections[currentSection].push(line.trim());
      }
    });
    
    // Rigorous achievement detection - must have numbers AND impact verbs
    const achievements = sentences.filter(sentence => {
      const hasNumbers = /\d+[%$]?/.test(sentence) || /\$[\d,]+/.test(sentence);
      const hasImpactVerb = /(increased|improved|reduced|achieved|delivered|exceeded|generated|saved|enhanced|optimized)/i.test(sentence);
      return hasNumbers && hasImpactVerb;
    });
    
    return {
      lines,
      sentences,
      bulletPoints,
      sections,
      achievements,
      wordCount: resumeText.split(/\s+/).length
    };
  }
  
  private extractQuotesRigorously(resumeText: string, contentAnalysis: any): ResumeQuote[] {
    const quotes: ResumeQuote[] = [];
    
    // STRICT weak language detection - no exceptions
    const weakPhrases = [
      'responsible for', 'duties included', 'worked on', 'helped with', 
      'involved in', 'participated in', 'assisted with', 'contributed to',
      'tasked with', 'assigned to', 'duties were', 'job involved',
      'was responsible', 'were responsible', 'my duties', 'my role',
      'experience with', 'familiar with', 'knowledge of'
    ];
    
    // Check every sentence rigorously
    contentAnalysis.sentences.forEach((sentence: string) => {
      if (sentence.trim().length < 15) return;
      
      const lowerSentence = sentence.toLowerCase();
      
      // Weak language detection - ZERO tolerance
      weakPhrases.forEach(weakPhrase => {
        if (lowerSentence.includes(weakPhrase)) {
          quotes.push({
            originalText: sentence.trim(),
            context: 'Weak language detected',
            issue: `Uses weak, passive language: "${weakPhrase}"`,
            suggestedImprovement: this.generateStrongerVersion(sentence, weakPhrase),
            category: 'weak_language'
          });
        }
      });
      
      // Missing metrics - harsh but fair
      if (this.hasActionWord(sentence) && !this.hasMetrics(sentence) && sentence.length > 25) {
        quotes.push({
          originalText: sentence.trim(),
          context: 'Achievement without quantification',
          issue: 'Missing specific numbers, percentages, or measurable impact',
          suggestedImprovement: this.addSpecificMetrics(sentence),
          category: 'missing_metrics'
        });
      }
      
      // Generic descriptions
      if (this.isGeneric(sentence)) {
        quotes.push({
          originalText: sentence.trim(),
          context: 'Generic, vague description',
          issue: 'Too vague - lacks specific details about your unique contributions',
          suggestedImprovement: this.makeMoreSpecific(sentence),
          category: 'generic_description'
        });
      }
    });
    
    return quotes.slice(0, 12); // Allow more quotes for comprehensive feedback
  }
  
  private scoreFormattingRigorously(resumeText: string, fileName: string, contentAnalysis: any): CategoryScore {
    let score = 25; // Start with full points, deduct harshly
    const issues: string[] = [];
    const positives: string[] = [];
    const examplesFromResume: string[] = [];
    
    // File format - strict requirements
    const fileExtension = fileName.toLowerCase().split('.').pop();
    if (!['pdf', 'docx'].includes(fileExtension || '')) {
      issues.push("File format is not ATS-friendly - use PDF or DOCX only");
      score -= 5; // Harsh penalty
    } else {
      positives.push("Professional file format");
    }
    
    // Contact info - must be perfect
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    const phonePattern = /(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/;
    
    const hasEmail = emailPattern.test(resumeText);
    const hasPhone = phonePattern.test(resumeText);
    
    if (!hasEmail) {
      issues.push("Missing or improperly formatted email address");
      score -= 4;
    }
    if (!hasPhone) {
      issues.push("Missing or improperly formatted phone number");
      score -= 4;
    }
    if (hasEmail && hasPhone) {
      positives.push("Contact information properly formatted");
      const email = resumeText.match(emailPattern)?.[0];
      const phone = resumeText.match(phonePattern)?.[0];
      examplesFromResume.push(`Contact: ${email}, ${phone}`);
    }
    
    // Length requirements - strict standards
    const wordCount = contentAnalysis.wordCount;
    if (wordCount < 250) {
      issues.push(`Resume too brief (${wordCount} words) - insufficient detail to assess qualifications`);
      score -= 6;
    } else if (wordCount > 600) {
      issues.push(`Resume too long (${wordCount} words) - HR managers will lose interest`);
      score -= 3;
    } else {
      positives.push(`Appropriate length (${wordCount} words)`);
    }
    
    // Section organization - must have all standard sections
    const requiredSections = ['experience', 'education', 'skills'];
    const foundSections = requiredSections.filter(section => 
      Object.keys(contentAnalysis.sections).includes(section) && 
      contentAnalysis.sections[section].length > 0
    );
    
    if (foundSections.length < 3) {
      issues.push(`Missing required sections: ${requiredSections.filter(s => !foundSections.includes(s)).join(', ')}`);
      score -= 4;
    } else {
      positives.push("All standard sections present");
    }
    
    // Professional summary requirement
    if (contentAnalysis.sections.summary.length === 0) {
      issues.push("Missing professional summary - critical for first impression");
      score -= 3;
    }
    
    const level = this.getScoreLevel(score, 25);
    const rigorousAssessment = score >= 20 ? 
      "Formatting meets professional standards" :
      score >= 15 ? 
      "Formatting has notable issues affecting professionalism" :
      "Significant formatting problems that hurt first impression";
    
    return {
      score: Math.max(0, score),
      maxScore: 25,
      level,
      explanation: `Formatting assessment based on strict professional standards`,
      whyItMatters: "Poor formatting can eliminate you before content review. HR managers judge professionalism instantly.",
      specificIssues: issues,
      positivePoints: positives,
      examplesFromResume,
      rigorousAssessment
    };
  }
  
  private scoreKeywordsRigorously(resumeText: string, contentAnalysis: any, resumeQuotes: ResumeQuote[]): CategoryScore {
    let score = 30; // Start with full points
    const issues: string[] = [];
    const positives: string[] = [];
    const examplesFromResume: string[] = [];
    
    // Action verbs - strict requirements
    const strongActionWords = ['managed', 'led', 'developed', 'created', 'implemented', 'improved', 'achieved', 'delivered', 'designed', 'optimized', 'increased', 'reduced', 'generated', 'established'];
    const foundActionWords = strongActionWords.filter(word => 
      resumeText.toLowerCase().includes(word)
    );
    
    // HARSH penalty for weak language
    const weakLanguageCount = resumeQuotes.filter(q => q.category === 'weak_language').length;
    if (weakLanguageCount > 5) {
      issues.push(`Excessive weak language (${weakLanguageCount} instances) - shows lack of ownership`);
      score -= 12; // Brutal penalty
    } else if (weakLanguageCount > 2) {
      issues.push(`Multiple instances of weak language (${weakLanguageCount}) - undermines impact`);
      score -= 6;
    } else if (weakLanguageCount > 0) {
      issues.push(`Weak language detected (${weakLanguageCount}) - use stronger action verbs`);
      score -= 3;
    }
    
    if (foundActionWords.length >= 6) {
      positives.push(`Strong action verb variety (${foundActionWords.length})`);
      examplesFromResume.push(`Action verbs: ${foundActionWords.slice(0, 5).join(', ')}`);
    } else if (foundActionWords.length >= 3) {
      positives.push(`Adequate action verbs (${foundActionWords.length})`);
      issues.push("Add more variety in action verbs for stronger impact");
      score -= 4;
    } else {
      issues.push("Severely lacking strong action verbs - content appears passive");
      score -= 8;
    }
    
    // Quantified achievements - NO MERCY for missing metrics
    const achievementCount = contentAnalysis.achievements.length;
    const missingMetricsCount = resumeQuotes.filter(q => q.category === 'missing_metrics').length;
    
    if (achievementCount === 0) {
      issues.push("ZERO quantified achievements - impossible to assess impact");
      score -= 10; // Devastating penalty
    } else if (achievementCount < 3) {
      issues.push(`Insufficient quantified achievements (${achievementCount}) - cannot demonstrate value`);
      score -= 6;
    } else {
      positives.push(`Good quantification (${achievementCount} achievements)`);
      examplesFromResume.push(`Quantified results found`);
    }
    
    if (missingMetricsCount > 3) {
      issues.push(`Many statements lack metrics (${missingMetricsCount}) - show measurable impact`);
      score -= 4;
    }
    
    // Technical skills presence
    const skillWords = ['sql', 'excel', 'tableau', 'python', 'analysis', 'data', 'management', 'leadership'];
    const skillCount = skillWords.filter(skill => 
      resumeText.toLowerCase().includes(skill)
    ).length;
    
    if (skillCount < 3) {
      issues.push("Insufficient technical skills keywords - may not match ATS requirements");
      score -= 3;
    }
    
    const level = this.getScoreLevel(score, 30);
    const rigorousAssessment = score >= 25 ? 
      "Strong keyword optimization with measurable achievements" :
      score >= 18 ? 
      "Adequate keywords but needs more quantification" :
      "Weak keyword strategy hurts ATS ranking and credibility";
    
    return {
      score: Math.max(0, score),
      maxScore: 30,
      level,
      explanation: `Keyword analysis based on ATS requirements and impact demonstration`,
      whyItMatters: "ATS systems reject 75% of resumes. Weak language and missing metrics signal inexperience.",
      specificIssues: issues,
      positivePoints: positives,
      examplesFromResume,
      rigorousAssessment
    };
  }
  
  private scoreContentRigorously(resumeText: string, contentAnalysis: any, resumeQuotes: ResumeQuote[]): CategoryScore {
    let score = 25;
    const issues: string[] = [];
    const positives: string[] = [];
    const examplesFromResume: string[] = [];
    
    // Professional summary - strict evaluation
    const summaryContent = contentAnalysis.sections.summary.join(' ');
    if (summaryContent.length === 0) {
      issues.push("Missing professional summary - critical first impression failure");
      score -= 5;
    } else if (summaryContent.length < 80) {
      issues.push("Professional summary too brief - fails to establish value proposition");
      score -= 3;
      examplesFromResume.push(`Brief summary: "${summaryContent}"`);
    } else {
      positives.push("Professional summary present");
      examplesFromResume.push(`Summary: "${summaryContent.substring(0, 80)}..."`);
    }
    
    // Achievement vs. duty ratio - harsh evaluation
    const achievementCount = contentAnalysis.achievements.length;
    const weakLanguageCount = resumeQuotes.filter(q => q.category === 'weak_language').length;
    
    if (achievementCount === 0 && weakLanguageCount > 3) {
      issues.push("Content focused entirely on duties rather than achievements - shows no impact");
      score -= 8; // Brutal penalty
    } else if (achievementCount < 2) {
      issues.push("Minimal achievement focus - mostly job duties listed");
      score -= 5;
    } else {
      positives.push(`Achievement-focused content (${achievementCount} quantified results)`);
    }
    
    // Work experience depth
    const experienceContent = contentAnalysis.sections.experience.join(' ');
    if (experienceContent.length < 200) {
      issues.push("Work experience section lacks sufficient detail");
      score -= 4;
    } else {
      positives.push("Comprehensive work experience");
    }
    
    // Skills section quality
    const skillsContent = contentAnalysis.sections.skills.join(' ');
    if (skillsContent.length < 50) {
      issues.push("Skills section inadequate - insufficient detail");
      score -= 3;
    } else {
      positives.push("Skills section present");
      examplesFromResume.push(`Skills: "${skillsContent.substring(0, 60)}..."`);
    }
    
    // Generic content penalty
    const genericCount = resumeQuotes.filter(q => q.category === 'generic_description').length;
    if (genericCount > 2) {
      issues.push(`Content too generic (${genericCount} vague descriptions) - lacks specific contributions`);
      score -= 3;
    }
    
    const level = this.getScoreLevel(score, 25);
    const rigorousAssessment = score >= 20 ? 
      "Content effectively demonstrates value through specific achievements" :
      score >= 15 ? 
      "Content adequate but needs stronger achievement focus" :
      "Content fails to differentiate candidate - appears inexperienced";
    
    return {
      score: Math.max(0, score),
      maxScore: 25,
      level,
      explanation: `Content quality based on achievement demonstration and value proposition`,
      whyItMatters: "HR managers need proof of impact, not job duty lists. Generic content suggests inexperience.",
      specificIssues: issues,
      positivePoints: positives,
      examplesFromResume,
      rigorousAssessment
    };
  }
  
  private scoreATSRigorously(resumeText: string, fileName: string, contentAnalysis: any): CategoryScore {
    let score = 20;
    const issues: string[] = [];
    const positives: string[] = [];
    const examplesFromResume: string[] = [];
    
    // File format - strict
    const fileExtension = fileName.toLowerCase().split('.').pop();
    if (!['pdf', 'docx'].includes(fileExtension || '')) {
      issues.push("File format incompatible with most ATS systems");
      score -= 6;
    } else {
      positives.push("ATS-compatible file format");
    }
    
    // Standard headers - required
    const requiredHeaders = ['experience', 'education', 'skills'];
    const foundHeaders = requiredHeaders.filter(header => 
      resumeText.toLowerCase().includes(header)
    );
    
    if (foundHeaders.length < 3) {
      issues.push(`Missing standard headers: ${requiredHeaders.filter(h => !foundHeaders.includes(h)).join(', ')}`);
      score -= 5;
    } else {
      positives.push("Standard section headers used");
      examplesFromResume.push(`Headers: ${foundHeaders.join(', ')}`);
    }
    
    // Contact format - must be parseable
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    const phonePattern = /(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/;
    
    if (!emailPattern.test(resumeText) || !phonePattern.test(resumeText)) {
      issues.push("Contact information not in ATS-parseable format");
      score -= 4;
    } else {
      positives.push("Contact information ATS-readable");
    }
    
    // Complex formatting check
    const specialChars = resumeText.match(/[^\w\s@.\-()]/g) || [];
    if (specialChars.length > 15) {
      issues.push("Excessive special characters may confuse ATS parsing");
      score -= 2;
    }
    
    const level = this.getScoreLevel(score, 20);
    const rigorousAssessment = score >= 17 ? 
      "High ATS compatibility - should parse correctly" :
      score >= 12 ? 
      "Moderate ATS compatibility with some parsing risks" :
      "Poor ATS compatibility - likely to be rejected automatically";
    
    return {
      score: Math.max(0, score),
      maxScore: 20,
      level,
      explanation: `ATS compatibility based on parsing requirements`,
      whyItMatters: "75% of resumes are rejected by ATS before human review. Incompatibility = automatic rejection.",
      specificIssues: issues,
      positivePoints: positives,
      examplesFromResume,
      rigorousAssessment
    };
  }
  
  private getScoreLevel(score: number, maxScore: number): 'excellent' | 'good' | 'needs_improvement' | 'poor' {
    const percentage = (score / maxScore) * 100;
    if (percentage >= 85) return 'excellent';
    if (percentage >= 70) return 'good';
    if (percentage >= 55) return 'needs_improvement';
    return 'poor';
  }
  
  // Helper methods for consistent processing
  private generateStrongerVersion(sentence: string, weakPhrase: string): string {
    const replacements: Record<string, string> = {
      'responsible for': 'managed',
      'duties included': 'delivered',
      'worked on': 'developed',
      'helped with': 'improved',
      'involved in': 'led',
      'participated in': 'drove',
      'assisted with': 'enhanced',
      'contributed to': 'delivered'
    };
    
    const replacement = replacements[weakPhrase] || 'achieved';
    return sentence.replace(new RegExp(weakPhrase, 'gi'), replacement);
  }
  
  private addSpecificMetrics(sentence: string): string {
    // Deterministic metric suggestions based on content
    if (/data|analysis/i.test(sentence)) return sentence + ', improving accuracy by 25%';
    if (/team|manage/i.test(sentence)) return sentence + ', leading team of 8 people';
    if (/project/i.test(sentence)) return sentence + ', delivering $200K+ project on time';
    if (/report/i.test(sentence)) return sentence + ', reducing reporting time by 40%';
    return sentence + ', achieving 15% improvement in efficiency';
  }
  
  private hasActionWord(sentence: string): boolean {
    const actionWords = ['managed', 'led', 'developed', 'created', 'implemented', 'improved', 'achieved', 'delivered'];
    return actionWords.some(word => sentence.toLowerCase().includes(word));
  }
  
  private hasMetrics(sentence: string): boolean {
    return /\d+[%$]?/.test(sentence) || /\$[\d,]+/.test(sentence);
  }
  
  private isGeneric(sentence: string): boolean {
    const genericPhrases = ['various', 'different', 'multiple', 'several', 'many'];
    return genericPhrases.some(phrase => sentence.toLowerCase().includes(phrase));
  }
  
  private makeMoreSpecific(sentence: string): string {
    return sentence
      .replace(/various/gi, '15 different')
      .replace(/multiple/gi, '5 separate')
      .replace(/several/gi, '7 distinct')
      .replace(/many/gi, '20+ individual');
  }
  
  private generateRigorousRecommendations(scoreBreakdown: any, resumeQuotes: ResumeQuote[], contentAnalysis: any): ContentSpecificRecommendation[] {
    const recommendations: ContentSpecificRecommendation[] = [];
    
    // Convert resume quotes to harsh recommendations
    resumeQuotes.forEach((quote) => {
      let priority: 'high' | 'medium' | 'low' = 'medium';
      
      if (quote.category === 'weak_language') priority = 'high';
      else if (quote.category === 'missing_metrics') priority = 'high';
      else if (quote.category === 'generic_description') priority = 'medium';
      
      recommendations.push({
        priority,
        category: quote.category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
        issue: quote.issue,
        solution: `Rewrite with specific, measurable language`,
        impact: priority === 'high' ? 'Critical - significantly impacts ATS ranking and credibility' : 'Important - affects professional perception',
        currentExample: quote.originalText,
        improvedExample: quote.suggestedImprovement,
        difficulty: 'medium',
        estimatedTimeToFix: '15-20 minutes'
      });
    });
    
    return recommendations.slice(0, 8);
  }
  
  private generateBrutallyHonestInsights(scoreBreakdown: any, contentAnalysis: any): EducationalInsight[] {
    const insights: EducationalInsight[] = [];
    
    insights.push({
      topic: "Why Your Score Might Be Lower Than Expected",
      explanation: "This scoring system uses professional standards, not grade inflation. A score below 70 indicates real issues that HR managers notice immediately.",
      betterExample: "Strong resumes demonstrate measurable impact, not just job duties",
      lexTip: "Ask me to rewrite specific sentences with quantified achievements!"
    });
    
    return insights;
  }
  
  private generateBrutallyHonestHRPerspective(
    overallScore: number, 
    scoreBreakdown: any,
    resumeQuotes: ResumeQuote[]
  ): HRPerspective {
    let firstImpression: string;
    let likelyOutcome: 'will_advance' | 'maybe_advance' | 'unlikely_advance';
    let brutallyHonestFeedback: string;
    
    if (overallScore >= 85) {
      firstImpression = "Strong candidate with clear achievements and professional presentation";
      likelyOutcome = 'will_advance';
      brutallyHonestFeedback = "This resume effectively demonstrates value and would advance in most hiring processes.";
    } else if (overallScore >= 70) {
      firstImpression = "Competent candidate but with noticeable presentation weaknesses";
      likelyOutcome = 'maybe_advance';
      brutallyHonestFeedback = "Resume shows potential but needs improvement to compete against stronger candidates.";
    } else if (overallScore >= 50) {
      firstImpression = "Candidate has relevant experience but resume fails to demonstrate impact effectively";
      likelyOutcome = 'unlikely_advance';
      brutallyHonestFeedback = "Multiple issues prevent this resume from standing out. Significant revision needed to be competitive.";
    } else {
      firstImpression = "Resume indicates inexperience with professional communication and lacks measurable achievements";
      likelyOutcome = 'unlikely_advance';
      brutallyHonestFeedback = "This resume would likely be rejected within seconds. Complete overhaul required to meet professional standards.";
    }
    
    const concerningElements = resumeQuotes.map(q => q.issue).slice(0, 3);
    const specificConcerns = resumeQuotes.map(q => q.originalText.substring(0, 60) + '...').slice(0, 2);
    
    return {
      firstImpression,
      likelyOutcome,
      timeToReview: "6-10 seconds",
      standoutElements: scoreBreakdown.content.positivePoints.slice(0, 2),
      concerningElements,
      overallAssessment: `Score: ${overallScore}/100 reflects actual competitiveness in today's job market.`,
      specificConcerns,
      brutallyHonestFeedback
    };
  }
}

export default RigorousConsistentScoringEngine;