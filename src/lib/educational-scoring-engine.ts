// Rigorous, Consistent, Brutally Honest Resume Scoring Engine
// NO GRADE INFLATION - Same input = Same output, every time

interface ResumeAnalysisResult {
  overallScore: number;
  scoreBreakdown: ScoreBreakdown;
  recommendations: ContentSpecificRecommendation[];
  educationalInsights: EducationalInsight[];
  hrPerspective: HRPerspective;
  resumeQuotes: ResumeQuote[];
  ruleIssues: RuleIssue[];
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
  category:
    | 'weak_language'
    | 'missing_metrics'
    | 'passive_voice'
    | 'unclear_impact'
    | 'responsibility_framing'
    | 'generic_description';
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
  deductions?: Array<{ reason: string; points: number }>;
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

interface RuleIssue {
  severity: 'high' | 'medium' | 'low';
  category: 'structure' | 'format' | 'verbiage' | 'impact' | 'ats';
  issue: string;
  evidence?: string;
  recommendation?: string;
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
    const baseScore = Math.max(0, formatting.score + keywords.score + content.score + atsCompatibility.score);
    
    const recommendations = this.generateRigorousRecommendations(
      { formatting, keywords, content, atsCompatibility },
      resumeQuotes,
      contentAnalysis
    );

    const ruleIssues = this.generateRuleIssues(resumeText, contentAnalysis, resumeQuotes);
    const rulePenalty = ruleIssues.reduce((sum, issue) => {
      if (issue.severity === 'high') return sum + 4;
      if (issue.severity === 'medium') return sum + 2;
      return sum + 1;
    }, 0);
    const overallScore = Math.max(0, baseScore - rulePenalty);
    
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
      ruleIssues,
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
    const seen = new Set<string>();
    const MAX_QUOTE_LENGTH = 240;
    const rawBullets: string[] =
      Array.isArray(contentAnalysis.bulletPoints) && contentAnalysis.bulletPoints.length > 0
        ? contentAnalysis.bulletPoints
        : [];
    const sentenceFallback: string[] = contentAnalysis.sentences || [];
    const candidates: string[] = [];

    rawBullets.forEach((bullet) => {
      if (!bullet || bullet.trim().length === 0) return;
      const cleaned = bullet.trim();
      candidates.push(cleaned);
      if (cleaned.length > 160 || /[;|]/.test(cleaned) || /\s[-–—]\s/.test(cleaned)) {
        cleaned
          .split(/\s[-–—|;]\s/)
          .map((part) => part.trim())
          .filter((part) => part.length > 10)
          .forEach((part) => candidates.push(part));
      }
    });

    if (candidates.length === 0) {
      candidates.push(...sentenceFallback);
    }
    
    // STRICT weak language detection - no exceptions
    const weakPhrases = [
      'responsible for', 'duties included', 'worked on', 'helped with',
      'involved in', 'participated in', 'assisted with', 'contributed to',
      'tasked with', 'assigned to', 'duties were', 'job involved',
      'was responsible', 'were responsible', 'my duties', 'my role',
      'experience with', 'familiar with', 'knowledge of',
      'supported', 'handled', 'coordinated', 'oversaw', 'maintained'
    ];
    
    // Check every candidate (prefer bullets, then sentences)
    candidates.forEach((sentence: string) => {
      if (!sentence || sentence.trim().length < 12) return;
      let added = false;
      const trimmedSentence = sentence.trim();
      const lowerSentence = trimmedSentence.toLowerCase();
      
      // Weak language detection - ZERO tolerance
      weakPhrases.forEach(weakPhrase => {
        if (!added && lowerSentence.includes(weakPhrase)) {
          const normalized = trimmedSentence.slice(0, MAX_QUOTE_LENGTH);
          const key = `weak_language|${weakPhrase}|${normalized.toLowerCase()}`;
          if (seen.has(key)) {
            added = true;
            return;
          }
          seen.add(key);
          quotes.push({
            originalText: normalized,
            context: 'Weak language detected',
            issue: `Uses weak, passive language: "${weakPhrase}"`,
            suggestedImprovement: this.generateStrongerVersion(trimmedSentence, weakPhrase),
            category: 'weak_language'
          });
          added = true;
        }
      });

      if (added) return;

      // Passive voice
      if (this.isPassiveVoice(trimmedSentence)) {
        const normalized = trimmedSentence.slice(0, MAX_QUOTE_LENGTH);
        const key = `passive_voice|${normalized.toLowerCase()}`;
        if (seen.has(key)) return;
        seen.add(key);
        quotes.push({
          originalText: normalized,
          context: 'Passive voice detected',
          issue: 'Uses passive voice instead of direct ownership',
          suggestedImprovement: this.convertToActiveVoice(trimmedSentence),
          category: 'passive_voice'
        });
        return;
      }

      // Responsibility framing without outcomes
      if (this.isResponsibilityFraming(trimmedSentence)) {
        const normalized = trimmedSentence.slice(0, MAX_QUOTE_LENGTH);
        const key = `responsibility_framing|${normalized.toLowerCase()}`;
        if (seen.has(key)) return;
        seen.add(key);
        quotes.push({
          originalText: normalized,
          context: 'Responsibility framing without outcomes',
          issue: 'Describes duties but not outcomes or impact',
          suggestedImprovement: this.addOutcomeFocus(trimmedSentence),
          category: 'responsibility_framing'
        });
        return;
      }

      // Missing metrics - action, but no numbers
      if (this.hasActionWord(trimmedSentence) && !this.hasMetrics(trimmedSentence) && trimmedSentence.length > 20) {
        const normalized = trimmedSentence.slice(0, MAX_QUOTE_LENGTH);
        const key = `missing_metrics|${normalized.toLowerCase()}`;
        if (seen.has(key)) return;
        seen.add(key);
        quotes.push({
          originalText: normalized,
          context: 'Achievement without quantification',
          issue: 'Missing specific numbers, percentages, or measurable impact',
          suggestedImprovement: this.addSpecificMetrics(trimmedSentence),
          category: 'missing_metrics'
        });
        return;
      }

      // Unclear impact - action present but no outcome or numbers
      if (this.hasActionWord(trimmedSentence) && !this.hasImpactOutcome(trimmedSentence) && !this.hasMetrics(trimmedSentence) && trimmedSentence.length > 20) {
        const normalized = trimmedSentence.slice(0, MAX_QUOTE_LENGTH);
        const key = `unclear_impact|${normalized.toLowerCase()}`;
        if (seen.has(key)) return;
        seen.add(key);
        quotes.push({
          originalText: normalized,
          context: 'Action without stated impact',
          issue: 'Unclear impact - the result of this action is not stated',
          suggestedImprovement: this.addOutcomeFocus(trimmedSentence),
          category: 'unclear_impact'
        });
        return;
      }
      
      // Generic descriptions
      if (this.isGeneric(trimmedSentence)) {
        const normalized = trimmedSentence.slice(0, MAX_QUOTE_LENGTH);
        const key = `generic_description|${normalized.toLowerCase()}`;
        if (seen.has(key)) return;
        seen.add(key);
        quotes.push({
          originalText: normalized,
          context: 'Generic, vague description',
          issue: 'Too vague - lacks specific details about your unique contributions',
          suggestedImprovement: this.makeMoreSpecific(trimmedSentence),
          category: 'generic_description'
        });
      }
    });
    
    return quotes.slice(0, 20); // Allow more quotes for comprehensive feedback
  }
  
  private scoreFormattingRigorously(resumeText: string, fileName: string, contentAnalysis: any): CategoryScore {
    let score = 25; // Start with full points, deduct harshly
    const issues: string[] = [];
    const positives: string[] = [];
    const examplesFromResume: string[] = [];
    const deductions: Array<{ reason: string; points: number }> = [];
    const addDeduction = (reason: string, points: number) => {
      issues.push(reason);
      deductions.push({ reason, points });
      score -= points;
    };
    
    // File format - strict requirements
    const fileExtension = fileName.toLowerCase().split('.').pop();
    if (!['pdf', 'docx'].includes(fileExtension || '')) {
      addDeduction("File format is not ATS-friendly - use PDF or DOCX only", 5);
    } else {
      positives.push("Professional file format");
    }
    
    // Contact info - must be perfect
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    const phonePattern = /(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/;
    
    const hasEmail = emailPattern.test(resumeText);
    const hasPhone = phonePattern.test(resumeText);
    
    if (!hasEmail) {
      addDeduction("Missing or improperly formatted email address", 4);
    }
    if (!hasPhone) {
      addDeduction("Missing or improperly formatted phone number", 4);
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
      addDeduction(`Resume too brief (${wordCount} words) - insufficient detail to assess qualifications`, 6);
    } else if (wordCount > 600) {
      addDeduction(`Resume too long (${wordCount} words) - HR managers will lose interest`, 3);
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
      addDeduction(`Missing required sections: ${requiredSections.filter(s => !foundSections.includes(s)).join(', ')}`, 4);
    } else {
      positives.push("All standard sections present");
    }
    
    // Professional summary requirement
    if (contentAnalysis.sections.summary.length === 0) {
      addDeduction("Missing professional summary - critical for first impression", 3);
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
      rigorousAssessment,
      deductions
    };
  }
  
  private scoreKeywordsRigorously(resumeText: string, contentAnalysis: any, resumeQuotes: ResumeQuote[]): CategoryScore {
    let score = 30; // Start with full points
    const issues: string[] = [];
    const positives: string[] = [];
    const examplesFromResume: string[] = [];
    const deductions: Array<{ reason: string; points: number }> = [];
    const addDeduction = (reason: string, points: number) => {
      issues.push(reason);
      deductions.push({ reason, points });
      score -= points;
    };
    
    // Action verbs - strict requirements
    const strongActionWords = ['managed', 'led', 'developed', 'created', 'implemented', 'improved', 'achieved', 'delivered', 'designed', 'optimized', 'increased', 'reduced', 'generated', 'established'];
    const foundActionWords = strongActionWords.filter(word => 
      resumeText.toLowerCase().includes(word)
    );
    
    // HARSH penalty for weak language
    const weakLanguageCount = resumeQuotes.filter(q => q.category === 'weak_language').length;
    const responsibilityCount = resumeQuotes.filter(q => q.category === 'responsibility_framing').length;
    const unclearImpactCount = resumeQuotes.filter(q => q.category === 'unclear_impact').length;
    const passiveVoiceCount = resumeQuotes.filter(q => q.category === 'passive_voice').length;
    if (weakLanguageCount > 5) {
      addDeduction(`Excessive weak language (${weakLanguageCount} instances) - shows lack of ownership`, 12);
    } else if (weakLanguageCount > 2) {
      addDeduction(`Multiple instances of weak language (${weakLanguageCount}) - undermines impact`, 6);
    } else if (weakLanguageCount > 0) {
      addDeduction(`Weak language detected (${weakLanguageCount}) - use stronger action verbs`, 3);
    }

    if (passiveVoiceCount > 2) {
      addDeduction(`Passive voice appears frequently (${passiveVoiceCount}) - reduce passive constructions`, 4);
    } else if (passiveVoiceCount > 0) {
      addDeduction(`Passive voice detected (${passiveVoiceCount}) - use active voice`, 2);
    }

    if (responsibilityCount > 1) {
      addDeduction(`Responsibility framing without outcomes (${responsibilityCount}) - show results`, 3);
    } else if (responsibilityCount > 0) {
      addDeduction(`Responsibility framing without outcomes detected`, 2);
    }

    if (unclearImpactCount > 1) {
      addDeduction(`Unclear impact in multiple statements (${unclearImpactCount})`, 3);
    } else if (unclearImpactCount > 0) {
      addDeduction(`Unclear impact detected`, 2);
    }
    
    if (foundActionWords.length >= 6) {
      positives.push(`Strong action verb variety (${foundActionWords.length})`);
      examplesFromResume.push(`Action verbs: ${foundActionWords.slice(0, 5).join(', ')}`);
    } else if (foundActionWords.length >= 3) {
      positives.push(`Adequate action verbs (${foundActionWords.length})`);
      addDeduction("Add more variety in action verbs for stronger impact", 4);
    } else {
      addDeduction("Severely lacking strong action verbs - content appears passive", 8);
    }
    
    // Quantified achievements - NO MERCY for missing metrics
    const achievementCount = contentAnalysis.achievements.length;
    const missingMetricsCount = resumeQuotes.filter(q => q.category === 'missing_metrics').length;
    
    if (achievementCount === 0) {
      addDeduction("ZERO quantified achievements - impossible to assess impact", 10);
    } else if (achievementCount < 3) {
      addDeduction(`Insufficient quantified achievements (${achievementCount}) - cannot demonstrate value`, 6);
    } else {
      positives.push(`Good quantification (${achievementCount} achievements)`);
      examplesFromResume.push(`Quantified results found`);
    }
    
    if (missingMetricsCount > 3) {
      addDeduction(`Many statements lack metrics (${missingMetricsCount}) - show measurable impact`, 4);
    }
    
    // Technical skills presence
    const skillWords = ['sql', 'excel', 'tableau', 'python', 'analysis', 'data', 'management', 'leadership'];
    const skillCount = skillWords.filter(skill => 
      resumeText.toLowerCase().includes(skill)
    ).length;
    
    if (skillCount < 3) {
      addDeduction("Insufficient technical skills keywords - may not match ATS requirements", 3);
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
      rigorousAssessment,
      deductions
    };
  }
  
  private scoreContentRigorously(resumeText: string, contentAnalysis: any, resumeQuotes: ResumeQuote[]): CategoryScore {
    let score = 25;
    const issues: string[] = [];
    const positives: string[] = [];
    const examplesFromResume: string[] = [];
    const deductions: Array<{ reason: string; points: number }> = [];
    const addDeduction = (reason: string, points: number) => {
      issues.push(reason);
      deductions.push({ reason, points });
      score -= points;
    };
    
    // Professional summary - strict evaluation
    const summaryContent = contentAnalysis.sections.summary.join(' ');
    if (summaryContent.length === 0) {
      addDeduction("Missing professional summary - critical first impression failure", 5);
    } else if (summaryContent.length < 80) {
      addDeduction("Professional summary too brief - fails to establish value proposition", 3);
      examplesFromResume.push(`Brief summary: "${summaryContent}"`);
    } else {
      positives.push("Professional summary present");
      examplesFromResume.push(`Summary: "${summaryContent.substring(0, 80)}..."`);
    }
    
    // Achievement vs. duty ratio - harsh evaluation
    const achievementCount = contentAnalysis.achievements.length;
    const weakLanguageCount = resumeQuotes.filter(q => q.category === 'weak_language').length;
    const responsibilityCount = resumeQuotes.filter(q => q.category === 'responsibility_framing').length;
    const unclearImpactCount = resumeQuotes.filter(q => q.category === 'unclear_impact').length;
    
    if (achievementCount === 0 && weakLanguageCount > 3) {
      addDeduction("Content focused entirely on duties rather than achievements - shows no impact", 8);
    } else if (achievementCount < 2) {
      addDeduction("Minimal achievement focus - mostly job duties listed", 5);
    } else {
      positives.push(`Achievement-focused content (${achievementCount} quantified results)`);
    }

    if (responsibilityCount > 1) {
      addDeduction(`Too many duty-style statements (${responsibilityCount}) - rewrite as outcomes`, 3);
    } else if (responsibilityCount > 0) {
      addDeduction(`Duty-style statement detected - emphasize outcomes`, 2);
    }

    if (unclearImpactCount > 1) {
      addDeduction(`Multiple statements lack clear impact (${unclearImpactCount})`, 3);
    } else if (unclearImpactCount > 0) {
      addDeduction(`Statement lacks clear impact`, 2);
    }
    
    // Work experience depth
    const experienceContent = contentAnalysis.sections.experience.join(' ');
    if (experienceContent.length < 200) {
      addDeduction("Work experience section lacks sufficient detail", 4);
    } else {
      positives.push("Comprehensive work experience");
    }
    
    // Skills section quality
    const skillsContent = contentAnalysis.sections.skills.join(' ');
    if (skillsContent.length < 50) {
      addDeduction("Skills section inadequate - insufficient detail", 3);
    } else {
      positives.push("Skills section present");
      examplesFromResume.push(`Skills: "${skillsContent.substring(0, 60)}..."`);
    }
    
    // Generic content penalty
    const genericCount = resumeQuotes.filter(q => q.category === 'generic_description').length;
    if (genericCount > 2) {
      addDeduction(`Content too generic (${genericCount} vague descriptions) - lacks specific contributions`, 3);
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
      rigorousAssessment,
      deductions
    };
  }
  
  private scoreATSRigorously(resumeText: string, fileName: string, contentAnalysis: any): CategoryScore {
    let score = 20;
    const issues: string[] = [];
    const positives: string[] = [];
    const examplesFromResume: string[] = [];
    const deductions: Array<{ reason: string; points: number }> = [];
    const addDeduction = (reason: string, points: number) => {
      issues.push(reason);
      deductions.push({ reason, points });
      score -= points;
    };
    
    // File format - strict
    const fileExtension = fileName.toLowerCase().split('.').pop();
    if (!['pdf', 'docx'].includes(fileExtension || '')) {
      addDeduction("File format incompatible with most ATS systems", 6);
    } else {
      positives.push("ATS-compatible file format");
    }
    
    // Standard headers - required
    const requiredHeaders = ['experience', 'education', 'skills'];
    const foundHeaders = requiredHeaders.filter(header => 
      resumeText.toLowerCase().includes(header)
    );
    
    if (foundHeaders.length < 3) {
      addDeduction(`Missing standard headers: ${requiredHeaders.filter(h => !foundHeaders.includes(h)).join(', ')}`, 5);
    } else {
      positives.push("Standard section headers used");
      examplesFromResume.push(`Headers: ${foundHeaders.join(', ')}`);
    }
    
    // Contact format - must be parseable
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    const phonePattern = /(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/;
    
    if (!emailPattern.test(resumeText) || !phonePattern.test(resumeText)) {
      addDeduction("Contact information not in ATS-parseable format", 4);
    } else {
      positives.push("Contact information ATS-readable");
    }
    
    // Complex formatting check
    const specialChars = resumeText.match(/[^\w\s@.\-()]/g) || [];
    if (specialChars.length > 15) {
      addDeduction("Excessive special characters may confuse ATS parsing", 2);
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
      rigorousAssessment,
      deductions
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
      'contributed to': 'delivered',
      'supported': 'strengthened',
      'handled': 'executed',
      'coordinated': 'orchestrated',
      'oversaw': 'led',
      'maintained': 'optimized'
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

  private convertToActiveVoice(sentence: string): string {
    // Simple deterministic conversion helper
    return sentence
      .replace(/\bwas\b/gi, 'led')
      .replace(/\bwere\b/gi, 'led')
      .replace(/\bbeen\b/gi, 'led')
      .replace(/\bbeing\b/gi, 'leading');
  }

  private addOutcomeFocus(sentence: string): string {
    if (/compliance|risk|audit/i.test(sentence)) return sentence + ', reducing compliance gaps and audit findings';
    if (/process|workflow/i.test(sentence)) return sentence + ', cutting cycle time by 30%';
    if (/report|analysis/i.test(sentence)) return sentence + ', improving decision speed by 25%';
    return sentence + ', delivering measurable impact to business outcomes';
  }
  
  private hasActionWord(sentence: string): boolean {
    const actionWords = [
      'managed', 'led', 'developed', 'created', 'implemented', 'improved', 'achieved', 'delivered',
      'designed', 'optimized', 'increased', 'reduced', 'generated', 'established', 'streamlined',
      'executed', 'built', 'launched', 'drove', 'coordinated', 'oversaw', 'analyzed', 'resolved'
    ];
    return actionWords.some(word => sentence.toLowerCase().includes(word));
  }
  
  private hasMetrics(sentence: string): boolean {
    return /\d+[%$]?/.test(sentence) || /\$[\d,]+/.test(sentence);
  }

  private hasImpactOutcome(sentence: string): boolean {
    const patterns = [
      /resulted in/i,
      /leading to/i,
      /resulting in/i,
      /improv(e|ed|ing)/i,
      /reduc(e|ed|ing)/i,
      /increas(e|ed|ing)/i,
      /boost(ed|ing)?/i,
      /saved/i,
      /cut/i,
      /delivered/i,
      /achiev(ed|ing)?/i,
      /revenue/i,
      /cost/i,
      /efficien/i,
      /accuracy/i,
      /compliance/i,
      /risk/i,
      /latency/i
    ];
    return patterns.some((p) => p.test(sentence));
  }

  private isPassiveVoice(sentence: string): boolean {
    return /\b(was|were|is|are|been|be|being)\b\s+\b\w+(ed|en)\b/i.test(sentence);
  }

  private isResponsibilityFraming(sentence: string): boolean {
    const verbs = ['managed', 'oversaw', 'supervised', 'coordinated', 'handled', 'administered', 'maintained'];
    const lower = sentence.toLowerCase();
    return verbs.some(v => lower.includes(v)) && !this.hasMetrics(sentence) && !this.hasImpactOutcome(sentence);
  }
  
  private isGeneric(sentence: string): boolean {
    const genericPhrases = ['various', 'different', 'multiple', 'several', 'many', 'numerous', 'diverse'];
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

  private generateRuleIssues(
    resumeText: string,
    contentAnalysis: any,
    resumeQuotes: ResumeQuote[]
  ): RuleIssue[] {
    const issues: RuleIssue[] = [];
    const wordCount = contentAnalysis.wordCount || 0;
    const bullets = contentAnalysis.bulletPoints || [];
    const experienceLines = contentAnalysis.sections.experience || [];
    const skillsLines = contentAnalysis.sections.skills || [];
    const summaryLines = contentAnalysis.sections.summary || [];
    const educationLines = contentAnalysis.sections.education || [];

    if (summaryLines.length === 0) {
      issues.push({
        severity: 'high',
        category: 'structure',
        issue: 'Missing professional summary section',
        recommendation: 'Add a 2–3 sentence summary that highlights role, domain, and measurable impact.'
      });
    }

    if (skillsLines.length === 0) {
      issues.push({
        severity: 'high',
        category: 'structure',
        issue: 'Missing skills section',
        recommendation: 'Add a skills section with tools, systems, and domain keywords.'
      });
    }

    if (educationLines.length === 0) {
      issues.push({
        severity: 'medium',
        category: 'structure',
        issue: 'Missing education section',
        recommendation: 'Add education, certifications, or relevant training.'
      });
    }

    if (experienceLines.length < 2) {
      issues.push({
        severity: 'high',
        category: 'structure',
        issue: 'Experience section too thin',
        recommendation: 'Expand experience with roles, dates, and measurable outcomes.'
      });
    }

    if (wordCount < 220) {
      issues.push({
        severity: 'high',
        category: 'format',
        issue: `Resume too brief (${wordCount} words)`,
        recommendation: 'Add more detail to experience and outcomes.'
      });
    } else if (wordCount < 280) {
      issues.push({
        severity: 'medium',
        category: 'format',
        issue: `Resume short (${wordCount} words)`,
        recommendation: 'Add more measurable impact to key bullets.'
      });
    } else if (wordCount > 750) {
      issues.push({
        severity: 'high',
        category: 'format',
        issue: `Resume too long (${wordCount} words)`,
        recommendation: 'Trim older roles and remove low-impact bullets.'
      });
    }

    const bulletWordCount = (text: string) =>
      text.split(/\s+/).filter((word) => word.trim().length > 0).length;
    const overlongMedium = bullets.filter((b: string) => bulletWordCount(b) > 35);
    const overlongHigh = bullets.filter((b: string) => bulletWordCount(b) > 45);
    const overlongSample = (overlongHigh[0] || overlongMedium[0] || '').trim();
    if (overlongHigh.length > 0) {
      issues.push({
        severity: 'high',
        category: 'format',
        issue: `Overlong bullets (${overlongHigh.length})`,
        evidence: overlongSample ? `${overlongSample} (${bulletWordCount(overlongSample)} words)` : undefined,
        recommendation: 'Split long bullets into two or trim to 45 words max.'
      });
    } else if (overlongMedium.length > 0) {
      issues.push({
        severity: 'medium',
        category: 'format',
        issue: `Overlong bullets (${overlongMedium.length})`,
        evidence: overlongSample ? `${overlongSample} (${bulletWordCount(overlongSample)} words)` : undefined,
        recommendation: 'Trim bullets to 35 words max or split into two.'
      });
    }

    const brackets = resumeText.match(/\[[^\]]+\]/g) || [];
    const placeholderMarkers = resumeText.match(/\b(TBD|TK|TKTK|XX+|N\/A|\?\?+)\b/gi) || [];
    if (brackets.length > 0) {
      issues.push({
        severity: 'high',
        category: 'format',
        issue: 'Bracket placeholders found (unfinished metrics)',
        evidence: brackets.slice(0, 3).join(', '),
        recommendation: 'Replace placeholders with real numbers or remove.'
      });
    }
    if (placeholderMarkers.length > 0) {
      issues.push({
        severity: 'high',
        category: 'format',
        issue: 'Placeholder markers found',
        evidence: placeholderMarkers.slice(0, 4).join(', '),
        recommendation: 'Remove placeholders and finalize missing values.'
      });
    }

    const metricsCount = (resumeText.match(/\d+[%$]?/g) || []).length;
    if (metricsCount < 5) {
      issues.push({
        severity: 'high',
        category: 'impact',
        issue: 'Low quantified impact across resume',
        recommendation: 'Add metrics to key bullets (volume, speed, cost, accuracy, scale).'
      });
    }

    const passiveCount = resumeQuotes.filter(q => q.category === 'passive_voice').length;
    if (passiveCount > 2) {
      issues.push({
        severity: 'medium',
        category: 'verbiage',
        issue: 'Frequent passive voice',
        recommendation: 'Rewrite passive constructions in active voice.'
      });
    }

    const responsibilityCount = resumeQuotes.filter(q => q.category === 'responsibility_framing').length;
    if (responsibilityCount > 2) {
      issues.push({
        severity: 'medium',
        category: 'impact',
        issue: 'Too many duty-framed statements',
        recommendation: 'Convert responsibilities into outcomes with measurable impact.'
      });
    }

    const unclearImpactCount = resumeQuotes.filter(q => q.category === 'unclear_impact').length;
    if (unclearImpactCount > 2) {
      issues.push({
        severity: 'medium',
        category: 'impact',
        issue: 'Multiple statements lack clear impact',
        recommendation: 'Add results to action statements (what changed, by how much).'
      });
    }

    return issues;
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
