// ATS Scoring Utilities
// src/lib/career-studio/atsScoring.ts

import type { ATSKeywords } from '@/types/job-analysis';

export interface ATSScoreBreakdown {
  overall: number;
  categories: {
    keywordMatch: number;
    formatting: number;
    content: number;
    actionVerbs: number;
  };
  details: ATSScoreDetail[];
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  passesATS: boolean;
}

export interface ATSScoreDetail {
  category: string;
  score: number;
  maxScore: number;
  findings: string[];
  suggestions: string[];
}

export interface KeywordDensity {
  keyword: string;
  count: number;
  density: number;
  isOptimal: boolean;
}

export interface FormatAnalysis {
  hasCleanStructure: boolean;
  hasBulletPoints: boolean;
  hasProperSections: boolean;
  hasContactInfo: boolean;
  issues: string[];
}

// Optimal keyword density range (1-3%)
const OPTIMAL_DENSITY_MIN = 0.5;
const OPTIMAL_DENSITY_MAX = 3.0;

/**
 * Calculate ATS score for a resume against job keywords
 */
export function calculateATSScore(
  resumeText: string,
  atsKeywords: ATSKeywords
): ATSScoreBreakdown {
  const details: ATSScoreDetail[] = [];

  // 1. Keyword Match Score (40 points max)
  const keywordScore = calculateKeywordMatchScore(resumeText, atsKeywords);
  details.push(keywordScore);

  // 2. Formatting Score (20 points max)
  const formattingScore = calculateFormattingScore(resumeText);
  details.push(formattingScore);

  // 3. Content Quality Score (25 points max)
  const contentScore = calculateContentScore(resumeText, atsKeywords);
  details.push(contentScore);

  // 4. Action Verb Score (15 points max)
  const actionVerbScore = calculateActionVerbScore(resumeText, atsKeywords);
  details.push(actionVerbScore);

  // Calculate overall score
  const overall = Math.round(
    keywordScore.score +
    formattingScore.score +
    contentScore.score +
    actionVerbScore.score
  );

  // Determine grade
  let grade: ATSScoreBreakdown['grade'];
  if (overall >= 85) grade = 'A';
  else if (overall >= 70) grade = 'B';
  else if (overall >= 55) grade = 'C';
  else if (overall >= 40) grade = 'D';
  else grade = 'F';

  return {
    overall,
    categories: {
      keywordMatch: keywordScore.score,
      formatting: formattingScore.score,
      content: contentScore.score,
      actionVerbs: actionVerbScore.score,
    },
    details,
    grade,
    passesATS: overall >= 60,
  };
}

/**
 * Calculate keyword match score
 */
function calculateKeywordMatchScore(
  resumeText: string,
  atsKeywords: ATSKeywords
): ATSScoreDetail {
  const resumeLower = resumeText.toLowerCase();
  const findings: string[] = [];
  const suggestions: string[] = [];

  let matchedHardSkills = 0;
  let totalHardSkills = atsKeywords.hardSkills.length;
  const missingHighPriority: string[] = [];

  // Check hard skills
  for (const skill of atsKeywords.hardSkills) {
    if (resumeLower.includes(skill.skill.toLowerCase())) {
      matchedHardSkills++;
    } else if (skill.importance === 'high') {
      missingHighPriority.push(skill.skill);
    }
  }

  // Check technologies
  let matchedTech = 0;
  for (const tech of atsKeywords.technologies) {
    if (resumeLower.includes(tech.technology.toLowerCase())) {
      matchedTech++;
    }
  }

  // Check soft skills
  let matchedSoftSkills = 0;
  for (const skill of atsKeywords.softSkills) {
    if (resumeLower.includes(skill.skill.toLowerCase())) {
      matchedSoftSkills++;
    }
  }

  // Check industry keywords
  let matchedIndustry = 0;
  for (const keyword of atsKeywords.industryKeywords) {
    if (resumeLower.includes(keyword.toLowerCase())) {
      matchedIndustry++;
    }
  }

  // Calculate score
  const hardSkillRatio = totalHardSkills > 0 ? matchedHardSkills / totalHardSkills : 1;
  const techRatio = atsKeywords.technologies.length > 0
    ? matchedTech / atsKeywords.technologies.length
    : 1;
  const softSkillRatio = atsKeywords.softSkills.length > 0
    ? matchedSoftSkills / atsKeywords.softSkills.length
    : 1;

  // Weight: Hard skills 50%, Technologies 30%, Soft skills 20%
  const score = Math.round((hardSkillRatio * 0.5 + techRatio * 0.3 + softSkillRatio * 0.2) * 40);

  // Generate findings
  findings.push(`Matched ${matchedHardSkills}/${totalHardSkills} hard skills`);
  findings.push(`Matched ${matchedTech}/${atsKeywords.technologies.length} technologies`);
  findings.push(`Matched ${matchedSoftSkills}/${atsKeywords.softSkills.length} soft skills`);

  // Generate suggestions
  if (missingHighPriority.length > 0) {
    suggestions.push(`Add critical skills: ${missingHighPriority.slice(0, 3).join(', ')}`);
  }

  if (matchedIndustry < atsKeywords.industryKeywords.length * 0.5) {
    suggestions.push('Include more industry-specific terminology');
  }

  return {
    category: 'Keyword Match',
    score,
    maxScore: 40,
    findings,
    suggestions,
  };
}

/**
 * Calculate formatting score
 */
function calculateFormattingScore(resumeText: string): ATSScoreDetail {
  const findings: string[] = [];
  const suggestions: string[] = [];
  let score = 0;

  // Check for bullet points
  const hasBullets = /[•\-\*]\s+\w/.test(resumeText);
  if (hasBullets) {
    score += 5;
    findings.push('Uses bullet points for readability');
  } else {
    suggestions.push('Add bullet points for better ATS parsing');
  }

  // Check for section headers
  const sectionPatterns = [
    /experience|work\s+history/i,
    /education|academic/i,
    /skills|competencies|expertise/i,
  ];

  let sectionsFound = 0;
  for (const pattern of sectionPatterns) {
    if (pattern.test(resumeText)) {
      sectionsFound++;
    }
  }

  if (sectionsFound >= 3) {
    score += 5;
    findings.push('Has proper section headers');
  } else {
    suggestions.push('Add clear section headers (Experience, Education, Skills)');
  }

  // Check for consistent formatting
  const lines = resumeText.split('\n');
  const shortLines = lines.filter(l => l.trim().length > 0 && l.trim().length < 100).length;
  const lineRatio = shortLines / lines.length;

  if (lineRatio > 0.7) {
    score += 5;
    findings.push('Good line length distribution');
  } else {
    suggestions.push('Break up long paragraphs into shorter, scannable lines');
  }

  // Check for contact info
  const hasEmail = /@/.test(resumeText);
  const hasPhone = /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/.test(resumeText);

  if (hasEmail && hasPhone) {
    score += 5;
    findings.push('Contact information present');
  } else {
    if (!hasEmail) suggestions.push('Add email address');
    if (!hasPhone) suggestions.push('Add phone number');
  }

  return {
    category: 'Formatting',
    score,
    maxScore: 20,
    findings,
    suggestions,
  };
}

/**
 * Calculate content quality score
 */
function calculateContentScore(
  resumeText: string,
  atsKeywords: ATSKeywords
): ATSScoreDetail {
  const findings: string[] = [];
  const suggestions: string[] = [];
  let score = 0;

  const words = resumeText.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // Optimal resume length: 400-800 words
  if (wordCount >= 400 && wordCount <= 800) {
    score += 8;
    findings.push(`Optimal length (${wordCount} words)`);
  } else if (wordCount >= 300 && wordCount <= 1000) {
    score += 4;
    findings.push(`Acceptable length (${wordCount} words)`);
    if (wordCount < 400) suggestions.push('Consider adding more detail');
    if (wordCount > 800) suggestions.push('Consider condensing content');
  } else {
    findings.push(`Length may need adjustment (${wordCount} words)`);
    suggestions.push(wordCount < 300 ? 'Resume is too brief' : 'Resume may be too long');
  }

  // Check for quantifiable achievements
  const quantifiablePatterns = [
    /increased?\s+.*\d+%/i,
    /reduced?\s+.*\d+%/i,
    /saved?\s+\$[\d,]+/i,
    /managed?\s+\d+/i,
    /led?\s+(?:a\s+)?team\s+of\s+\d+/i,
    /\d+%\s+(?:increase|decrease|growth|improvement)/i,
    /\$[\d,]+[kKmM]?\s+(?:revenue|sales|budget)/i,
  ];

  let quantifiableCount = 0;
  for (const pattern of quantifiablePatterns) {
    if (pattern.test(resumeText)) {
      quantifiableCount++;
    }
  }

  if (quantifiableCount >= 5) {
    score += 10;
    findings.push('Strong use of quantifiable achievements');
  } else if (quantifiableCount >= 2) {
    score += 5;
    findings.push('Some quantifiable achievements');
    suggestions.push('Add more metrics and numbers to achievements');
  } else {
    suggestions.push('Include quantifiable achievements (%, $, numbers)');
  }

  // Check for key phrases from job
  let keyPhraseMatches = 0;
  const resumeLower = resumeText.toLowerCase();
  for (const phrase of atsKeywords.keyPhrases || []) {
    if (resumeLower.includes(phrase.toLowerCase())) {
      keyPhraseMatches++;
    }
  }

  if (keyPhraseMatches >= 3) {
    score += 7;
    findings.push('Contains relevant key phrases from job posting');
  } else if (keyPhraseMatches >= 1) {
    score += 3;
    suggestions.push('Include more phrases that mirror job posting language');
  }

  return {
    category: 'Content Quality',
    score,
    maxScore: 25,
    findings,
    suggestions,
  };
}

/**
 * Calculate action verb score
 */
function calculateActionVerbScore(
  resumeText: string,
  atsKeywords: ATSKeywords
): ATSScoreDetail {
  const findings: string[] = [];
  const suggestions: string[] = [];
  const resumeLower = resumeText.toLowerCase();

  // Strong action verbs
  const strongVerbs = [
    'achieved', 'accelerated', 'accomplished', 'advanced', 'built', 'created',
    'delivered', 'developed', 'drove', 'established', 'executed', 'generated',
    'implemented', 'improved', 'increased', 'initiated', 'launched', 'led',
    'managed', 'negotiated', 'optimized', 'orchestrated', 'pioneered', 'produced',
    'reduced', 'resolved', 'spearheaded', 'streamlined', 'strengthened', 'transformed',
  ];

  // Weak verbs to avoid
  const weakVerbs = [
    'helped', 'assisted', 'worked on', 'was responsible for', 'duties included',
    'participated', 'involved in',
  ];

  let strongVerbCount = 0;
  let weakVerbCount = 0;
  const foundStrong: string[] = [];

  for (const verb of strongVerbs) {
    if (resumeLower.includes(verb)) {
      strongVerbCount++;
      foundStrong.push(verb);
    }
  }

  for (const verb of weakVerbs) {
    if (resumeLower.includes(verb)) {
      weakVerbCount++;
    }
  }

  // Check action words from job posting
  let jobVerbMatches = 0;
  for (const verb of atsKeywords.actionWords || []) {
    if (resumeLower.includes(verb.toLowerCase())) {
      jobVerbMatches++;
    }
  }

  // Calculate score
  let score = 0;

  if (strongVerbCount >= 10) {
    score += 10;
    findings.push('Excellent use of strong action verbs');
  } else if (strongVerbCount >= 5) {
    score += 6;
    findings.push(`Uses ${strongVerbCount} strong action verbs`);
    suggestions.push('Consider adding more action verbs like: ' + strongVerbs.slice(0, 5).join(', '));
  } else {
    score += 2;
    suggestions.push('Start bullet points with strong action verbs');
  }

  if (weakVerbCount >= 3) {
    score -= 2;
    suggestions.push('Replace weak phrases like "helped" or "was responsible for"');
  }

  if (jobVerbMatches >= 3) {
    score += 5;
    findings.push('Uses action verbs from job posting');
  } else if (atsKeywords.actionWords && atsKeywords.actionWords.length > 0) {
    suggestions.push(`Include action verbs from job: ${atsKeywords.actionWords.slice(0, 3).join(', ')}`);
  }

  return {
    category: 'Action Verbs',
    score: Math.max(0, Math.min(score, 15)),
    maxScore: 15,
    findings,
    suggestions,
  };
}

/**
 * Calculate keyword density
 */
export function calculateKeywordDensity(
  resumeText: string,
  keywords: string[]
): KeywordDensity[] {
  const words = resumeText.split(/\s+/).filter(Boolean);
  const totalWords = words.length;
  const resumeLower = resumeText.toLowerCase();

  return keywords.map(keyword => {
    const keywordLower = keyword.toLowerCase();
    const regex = new RegExp(`\\b${keywordLower}\\b`, 'gi');
    const matches = resumeLower.match(regex) || [];
    const count = matches.length;
    const density = (count / totalWords) * 100;

    return {
      keyword,
      count,
      density: Math.round(density * 100) / 100,
      isOptimal: density >= OPTIMAL_DENSITY_MIN && density <= OPTIMAL_DENSITY_MAX,
    };
  });
}

/**
 * Analyze resume format for ATS compatibility
 */
export function analyzeATSFormat(resumeText: string): FormatAnalysis {
  const issues: string[] = [];

  // Check for problematic characters
  const hasSpecialChars = /[^\x00-\x7F]/.test(resumeText);
  if (hasSpecialChars) {
    issues.push('Contains special characters that may not parse correctly');
  }

  // Check for tables (indicated by multiple tabs or pipes)
  const hasTables = /\t{2,}|\|.*\|/.test(resumeText);
  if (hasTables) {
    issues.push('May contain tables which can confuse ATS systems');
  }

  // Check for images/graphics indicators
  const hasImageRefs = /\[image\]|\.png|\.jpg|\.gif/i.test(resumeText);
  if (hasImageRefs) {
    issues.push('Contains image references - ensure text is not in images');
  }

  // Check structure
  const hasBulletPoints = /[•\-\*]\s/.test(resumeText);
  const lines = resumeText.split('\n');
  const hasProperSections = lines.some(l => /^[A-Z][A-Z\s]+$/m.test(l.trim()));
  const hasContactInfo = /@/.test(resumeText) && /\d{3}/.test(resumeText);

  if (!hasBulletPoints) {
    issues.push('No bullet points detected');
  }

  if (!hasProperSections) {
    issues.push('Section headers may not be clearly defined');
  }

  if (!hasContactInfo) {
    issues.push('Contact information may be missing');
  }

  return {
    hasCleanStructure: issues.length < 2,
    hasBulletPoints,
    hasProperSections,
    hasContactInfo,
    issues,
  };
}

/**
 * Get ATS optimization suggestions
 */
export function getATSOptimizationSuggestions(scoreBreakdown: ATSScoreBreakdown): string[] {
  const suggestions: string[] = [];

  // Collect all suggestions from details
  for (const detail of scoreBreakdown.details) {
    suggestions.push(...detail.suggestions);
  }

  // Add grade-specific suggestions
  if (scoreBreakdown.grade === 'D' || scoreBreakdown.grade === 'F') {
    suggestions.unshift('Your resume needs significant optimization for ATS compatibility');
  }

  // Prioritize and deduplicate
  return [...new Set(suggestions)].slice(0, 10);
}

/**
 * Quick ATS compatibility check
 */
export function quickATSCheck(resumeText: string): {
  score: number;
  issues: string[];
  isCompatible: boolean;
} {
  const format = analyzeATSFormat(resumeText);
  const words = resumeText.split(/\s+/).filter(Boolean).length;

  let score = 100;
  const issues = [...format.issues];

  // Deduct for format issues
  score -= format.issues.length * 10;

  // Check length
  if (words < 200) {
    score -= 20;
    issues.push('Resume is too short');
  } else if (words > 1500) {
    score -= 10;
    issues.push('Resume may be too long');
  }

  // Check for common ATS-unfriendly elements
  if (!format.hasBulletPoints) score -= 15;
  if (!format.hasProperSections) score -= 15;
  if (!format.hasContactInfo) score -= 20;

  return {
    score: Math.max(0, score),
    issues,
    isCompatible: score >= 60,
  };
}
