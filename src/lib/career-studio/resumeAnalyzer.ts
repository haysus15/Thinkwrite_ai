// Resume Analyzer Utilities
// src/lib/career-studio/resumeAnalyzer.ts

import type { ATSKeywords } from '@/types/job-analysis';

export interface ResumeSection {
  type: 'contact' | 'summary' | 'experience' | 'education' | 'skills' | 'certifications' | 'projects' | 'other';
  content: string;
  startLine: number;
  endLine: number;
}

export interface ResumeAnalysis {
  sections: ResumeSection[];
  skills: string[];
  experience: ExperienceEntry[];
  education: EducationEntry[];
  certifications: string[];
  contactInfo: ContactInfo;
  wordCount: number;
  estimatedYearsExperience: number;
}

export interface ExperienceEntry {
  title: string;
  company: string;
  duration?: string;
  bullets: string[];
  startYear?: number;
  endYear?: number;
}

export interface EducationEntry {
  degree: string;
  institution: string;
  year?: number;
  field?: string;
}

export interface ContactInfo {
  email?: string;
  phone?: string;
  linkedin?: string;
  location?: string;
}

export interface MatchResult {
  overallScore: number;
  skillMatches: SkillMatch[];
  missingSkills: string[];
  matchedKeywords: string[];
  suggestions: string[];
}

export interface SkillMatch {
  skill: string;
  found: boolean;
  importance: 'high' | 'medium' | 'low';
  context?: string;
}

// Section detection patterns
const SECTION_PATTERNS: Record<ResumeSection['type'], RegExp[]> = {
  contact: [/^contact/i, /^personal\s+info/i],
  summary: [/^summary/i, /^objective/i, /^profile/i, /^about\s+me/i, /^professional\s+summary/i],
  experience: [/^experience/i, /^work\s+experience/i, /^employment/i, /^work\s+history/i, /^professional\s+experience/i],
  education: [/^education/i, /^academic/i, /^qualifications/i],
  skills: [/^skills/i, /^technical\s+skills/i, /^core\s+competencies/i, /^expertise/i, /^proficiencies/i],
  certifications: [/^certifications?/i, /^licenses?/i, /^credentials/i],
  projects: [/^projects?/i, /^portfolio/i, /^key\s+projects/i],
  other: [],
};

/**
 * Extract sections from resume text
 */
export function extractSections(resumeText: string): ResumeSection[] {
  const lines = resumeText.split('\n');
  const sections: ResumeSection[] = [];
  let currentSection: ResumeSection | null = null;
  let currentContent: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Check if this line is a section header
    let detectedType: ResumeSection['type'] | null = null;
    for (const [type, patterns] of Object.entries(SECTION_PATTERNS)) {
      if (type === 'other') continue;
      for (const pattern of patterns) {
        if (pattern.test(line) && line.length < 50) {
          detectedType = type as ResumeSection['type'];
          break;
        }
      }
      if (detectedType) break;
    }

    if (detectedType) {
      // Save previous section
      if (currentSection) {
        currentSection.content = currentContent.join('\n');
        currentSection.endLine = i - 1;
        sections.push(currentSection);
      }

      // Start new section
      currentSection = {
        type: detectedType,
        content: '',
        startLine: i,
        endLine: i,
      };
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  // Save last section
  if (currentSection) {
    currentSection.content = currentContent.join('\n');
    currentSection.endLine = lines.length - 1;
    sections.push(currentSection);
  }

  return sections;
}

/**
 * Extract skills from resume text
 */
export function extractSkills(resumeText: string): string[] {
  const skills: Set<string> = new Set();
  const textLower = resumeText.toLowerCase();

  // Common technical skills to look for
  const technicalSkills = [
    'python', 'javascript', 'typescript', 'java', 'c++', 'c#', 'ruby', 'go', 'rust', 'php', 'swift', 'kotlin',
    'react', 'angular', 'vue', 'node.js', 'express', 'django', 'flask', 'spring', 'rails',
    'sql', 'mysql', 'postgresql', 'mongodb', 'redis', 'elasticsearch',
    'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform', 'jenkins', 'git',
    'html', 'css', 'sass', 'less', 'tailwind', 'bootstrap',
    'excel', 'powerpoint', 'word', 'tableau', 'power bi', 'salesforce', 'sap',
    'machine learning', 'data analysis', 'data science', 'ai', 'deep learning',
    'agile', 'scrum', 'jira', 'confluence', 'asana', 'trello',
  ];

  // Common soft skills
  const softSkills = [
    'leadership', 'communication', 'teamwork', 'problem solving', 'analytical',
    'project management', 'time management', 'critical thinking', 'collaboration',
    'presentation', 'negotiation', 'strategic planning', 'mentoring',
  ];

  for (const skill of [...technicalSkills, ...softSkills]) {
    if (textLower.includes(skill)) {
      skills.add(skill);
    }
  }

  return Array.from(skills);
}

/**
 * Extract contact information from resume
 */
export function extractContactInfo(resumeText: string): ContactInfo {
  const contact: ContactInfo = {};

  // Email pattern
  const emailMatch = resumeText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) {
    contact.email = emailMatch[0];
  }

  // Phone pattern (various formats)
  const phoneMatch = resumeText.match(/(?:\+\d{1,2}\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
  if (phoneMatch) {
    contact.phone = phoneMatch[0];
  }

  // LinkedIn pattern
  const linkedinMatch = resumeText.match(/linkedin\.com\/in\/[a-zA-Z0-9-]+/i);
  if (linkedinMatch) {
    contact.linkedin = linkedinMatch[0];
  }

  return contact;
}

/**
 * Estimate years of experience from resume text
 */
export function estimateYearsOfExperience(resumeText: string): number {
  const yearPattern = /(\d{4})\s*[-–—to]+\s*(present|\d{4})/gi;
  const matches = [...resumeText.matchAll(yearPattern)];

  if (matches.length === 0) return 0;

  const currentYear = new Date().getFullYear();
  let totalYears = 0;

  for (const match of matches) {
    const startYear = parseInt(match[1]);
    const endYear = match[2].toLowerCase() === 'present' ? currentYear : parseInt(match[2]);

    if (startYear >= 1970 && startYear <= currentYear && endYear >= startYear) {
      totalYears += endYear - startYear;
    }
  }

  return Math.min(totalYears, 50); // Cap at 50 years
}

/**
 * Calculate match score between resume and job keywords
 */
export function calculateMatchScore(resumeText: string, atsKeywords: ATSKeywords): MatchResult {
  const resumeLower = resumeText.toLowerCase();
  const skillMatches: SkillMatch[] = [];
  const missingSkills: string[] = [];
  const matchedKeywords: string[] = [];
  const suggestions: string[] = [];

  let totalWeight = 0;
  let matchedWeight = 0;

  // Check hard skills
  for (const skill of atsKeywords.hardSkills) {
    const weight = skill.importance === 'high' ? 3 : skill.importance === 'medium' ? 2 : 1;
    totalWeight += weight;

    const found = resumeLower.includes(skill.skill.toLowerCase());
    skillMatches.push({
      skill: skill.skill,
      found,
      importance: skill.importance,
    });

    if (found) {
      matchedWeight += weight;
      matchedKeywords.push(skill.skill);
    } else {
      missingSkills.push(skill.skill);
      if (skill.importance === 'high') {
        suggestions.push(`Add "${skill.skill}" to your resume - it's a key requirement`);
      }
    }
  }

  // Check soft skills
  for (const skill of atsKeywords.softSkills) {
    const weight = skill.importance === 'high' ? 2 : 1;
    totalWeight += weight;

    const found = resumeLower.includes(skill.skill.toLowerCase());
    if (found) {
      matchedWeight += weight;
      matchedKeywords.push(skill.skill);
    }
  }

  // Check technologies
  for (const tech of atsKeywords.technologies) {
    totalWeight += 2;
    const found = resumeLower.includes(tech.technology.toLowerCase());
    if (found) {
      matchedWeight += 2;
      matchedKeywords.push(tech.technology);
    } else {
      missingSkills.push(tech.technology);
    }
  }

  // Check action words
  let actionWordsFound = 0;
  for (const word of atsKeywords.actionWords) {
    if (resumeLower.includes(word.toLowerCase())) {
      actionWordsFound++;
    }
  }

  if (actionWordsFound < atsKeywords.actionWords.length * 0.3) {
    suggestions.push('Use more action verbs like: ' + atsKeywords.actionWords.slice(0, 3).join(', '));
  }

  const overallScore = totalWeight > 0 ? Math.round((matchedWeight / totalWeight) * 100) : 0;

  // Add general suggestions based on score
  if (overallScore < 50) {
    suggestions.push('Your resume may need significant tailoring for this role');
  } else if (overallScore < 70) {
    suggestions.push('Consider adding missing key skills to improve your match');
  }

  return {
    overallScore,
    skillMatches,
    missingSkills,
    matchedKeywords,
    suggestions,
  };
}

/**
 * Generate tailoring suggestions for a resume
 */
export function generateTailoringSuggestions(
  resumeText: string,
  atsKeywords: ATSKeywords
): string[] {
  const matchResult = calculateMatchScore(resumeText, atsKeywords);
  const suggestions: string[] = [...matchResult.suggestions];

  // Add keyword-specific suggestions
  const highPriorityMissing = matchResult.skillMatches
    .filter(m => !m.found && m.importance === 'high')
    .map(m => m.skill);

  if (highPriorityMissing.length > 0) {
    suggestions.unshift(
      `Critical: Add these required skills: ${highPriorityMissing.join(', ')}`
    );
  }

  // Check for industry keywords
  const missingIndustryTerms = atsKeywords.industryKeywords.filter(
    term => !resumeText.toLowerCase().includes(term.toLowerCase())
  );

  if (missingIndustryTerms.length > 0) {
    suggestions.push(
      `Include industry terms: ${missingIndustryTerms.slice(0, 3).join(', ')}`
    );
  }

  return suggestions;
}

/**
 * Analyze resume completeness
 */
export function analyzeCompleteness(resumeText: string): {
  score: number;
  missing: string[];
  present: string[];
} {
  const sections = extractSections(resumeText);
  const sectionTypes = new Set(sections.map(s => s.type));

  const requiredSections = ['experience', 'education', 'skills'];
  const optionalSections = ['summary', 'certifications', 'projects'];

  const missing: string[] = [];
  const present: string[] = [];

  for (const section of requiredSections) {
    if (sectionTypes.has(section as ResumeSection['type'])) {
      present.push(section);
    } else {
      missing.push(section);
    }
  }

  for (const section of optionalSections) {
    if (sectionTypes.has(section as ResumeSection['type'])) {
      present.push(section);
    }
  }

  const contact = extractContactInfo(resumeText);
  if (contact.email) present.push('email');
  else missing.push('email');

  if (contact.phone) present.push('phone');
  if (contact.linkedin) present.push('linkedin');

  const totalChecks = requiredSections.length + 1; // +1 for email
  const score = Math.round((present.filter(p => requiredSections.includes(p) || p === 'email').length / totalChecks) * 100);

  return { score, missing, present };
}

/**
 * Full resume analysis
 */
export function analyzeResume(resumeText: string): ResumeAnalysis {
  const sections = extractSections(resumeText);
  const skills = extractSkills(resumeText);
  const contactInfo = extractContactInfo(resumeText);
  const wordCount = resumeText.split(/\s+/).filter(Boolean).length;
  const estimatedYearsExperience = estimateYearsOfExperience(resumeText);

  return {
    sections,
    skills,
    experience: [], // Would require AI for accurate extraction
    education: [], // Would require AI for accurate extraction
    certifications: [],
    contactInfo,
    wordCount,
    estimatedYearsExperience,
  };
}
