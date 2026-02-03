// Resume-Job Match Calculator - FIXED to use extractedText
// src/lib/resume-job-match-calculator.ts

export interface SkillItem {
  skill: string;
  frequency?: number;
  importance?: 'high' | 'medium' | 'low';
  category?: string;
}

export interface TechItem {
  technology: string;
  frequency?: number;
  category?: string;
}

export interface ExperienceItem {
  keyword?: string;
  yearsRequired?: string;
  level?: string;
  specificExperience?: string[];
}

export interface EducationItem {
  level?: string;
  field?: string;
  requirement?: string;
}

export interface ResumeData {
  skills: string[] | SkillItem[];
  experience: any[] | { years?: number; roles?: any[] };
  education: any[] | { degree?: string; field?: string }[];
  extractedText?: string;
}

export interface JobData {
  hardSkills: SkillItem[];
  softSkills: SkillItem[];
  technologies: TechItem[];
  educationRequirements: string[] | EducationItem[];
  experienceKeywords: ExperienceItem[];
  certifications?: string[];
}

export interface MatchBreakdown {
  score: number;
  matched: string[];
  missing: string[];
  details?: string;
}

export interface MatchResult {
  matchScore: number;
  skillsMatch: MatchBreakdown;
  experienceMatch: {
    score: number;
    resumeYears: number;
    requiredYears: number;
    relevantExperience: string[];
    missingExperience: string[];
  };
  educationMatch: {
    score: number;
    matched: boolean;
    resumeEducation: string[];
    requiredEducation: string[];
    details: string;
  };
  technologiesMatch: MatchBreakdown;
  gaps: string[];
  strengths: string[];
  recommendation: string;
}

// ✅ NEW: Parse resume text to extract skills/experience/education
function parseResumeText(text: string): {
  skills: string[];
  experienceYears: number;
  educationLevels: string[];
} {
  if (!text) return { skills: [], experienceYears: 0, educationLevels: [] };

  const lowerText = text.toLowerCase();
  const skills: Set<string> = new Set();
  const educationLevels: string[] = [];

  // Extract years of experience from patterns like "4 years", "4+ years", "2016-2024"
  let experienceYears = 0;
  
  // Pattern 1: "X years of experience"
  const yearsMatch = text.match(/(\d+)\+?\s*years?\s*(of\s*)?experience/i);
  if (yearsMatch) {
    experienceYears = parseInt(yearsMatch[1]);
  }
  
  // Pattern 2: Date ranges (2020-2024, etc)
  const dateRanges = text.match(/\(?\d{4}\s*[-–]\s*(\d{4}|present|current)\)?/gi);
  if (dateRanges) {
    const currentYear = new Date().getFullYear();
    dateRanges.forEach(range => {
      const years = range.match(/(\d{4})/g);
      if (years && years.length >= 1) {
        const startYear = parseInt(years[0]);
        const endYear = range.toLowerCase().includes('present') || range.toLowerCase().includes('current')
          ? currentYear
          : (years[1] ? parseInt(years[1]) : currentYear);
        experienceYears += Math.max(0, endYear - startYear);
      }
    });
  }

  // Extract education levels
  const eduPatterns = [
    { pattern: /\b(phd|ph\.d\.|doctorate|doctoral)\b/i, level: 'PhD' },
    { pattern: /\b(master|masters|m\.s\.|m\.a\.|mba|ms|ma)\b/i, level: 'Masters' },
    { pattern: /\b(bachelor|bachelors|b\.s\.|b\.a\.|bs|ba)\b/i, level: 'Bachelors' },
    { pattern: /\b(associate|associates|a\.s\.|a\.a\.|as|aa)\b/i, level: 'Associates' },
  ];
  
  for (const { pattern, level } of eduPatterns) {
    if (pattern.test(text)) {
      educationLevels.push(level);
    }
  }

  // Extract common tech skills and tools
  const commonSkills = [
    // Programming languages
    'python', 'javascript', 'typescript', 'java', 'c++', 'c#', 'ruby', 'php', 'go', 'rust', 'swift', 'kotlin',
    // Web tech
    'react', 'angular', 'vue', 'node', 'nodejs', 'express', 'django', 'flask', 'spring',
    // Databases
    'sql', 'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'oracle', 'sql server',
    // Cloud & DevOps
    'aws', 'azure', 'gcp', 'google cloud', 'docker', 'kubernetes', 'jenkins', 'terraform', 'ansible',
    // Data & Analytics
    'tableau', 'power bi', 'excel', 'pandas', 'numpy', 'spark', 'hadoop', 'kafka',
    // Tools & Methodologies
    'git', 'jira', 'agile', 'scrum', 'rest api', 'graphql', 'microservices',
    // Trade/Logistics specific
    'customs', 'trade compliance', 'logistics', 'supply chain', 'cargowise', 'ace', 'aes',
    'harmonized tariff', 'hs code', 'import', 'export', 'freight', 'warehouse',
    'inventory management', 'shipment', 'documentation', 'compliance',
    // Soft skills
    'communication', 'leadership', 'project management', 'problem solving', 'analytical',
    'teamwork', 'collaboration', 'attention to detail', 'time management',
    // Office
    'microsoft office', 'word', 'powerpoint', 'outlook', 'smartsheet', 'slack', 'teams'
  ];

  for (const skill of commonSkills) {
    if (lowerText.includes(skill.toLowerCase())) {
      skills.add(skill);
    }
  }

  return {
    skills: Array.from(skills),
    experienceYears,
    educationLevels
  };
}

// Normalize a skill string for comparison
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Check if two skills match (fuzzy matching)
function skillsMatch(skill1: string, skill2: string): boolean {
  const s1 = normalizeString(skill1);
  const s2 = normalizeString(skill2);
  
  if (s1 === s2) return true;
  if (s1.includes(s2) || s2.includes(s1)) return true;
  
  // Common variations
  const variations: Record<string, string[]> = {
    'excel': ['microsoft excel', 'ms excel', 'excel'],
    'sql': ['sql', 'postgresql', 'mysql', 'sql server', 'tsql'],
    'python': ['python', 'python3'],
    'javascript': ['javascript', 'js'],
    'react': ['react', 'reactjs'],
    'node': ['node', 'nodejs'],
    'aws': ['aws', 'amazon web services'],
    'customs': ['customs', 'custom', 'cbp', 'customs brokerage'],
    'cargowise': ['cargowise', 'cargo wise', 'cargowise one'],
  };
  
  for (const variants of Object.values(variations)) {
    const s1Match = variants.some(v => s1.includes(v) || v.includes(s1));
    const s2Match = variants.some(v => s2.includes(v) || v.includes(s2));
    if (s1Match && s2Match) return true;
  }
  
  return false;
}

// Extract skill names from various formats
function extractSkillNames(skills: string[] | SkillItem[]): string[] {
  if (!skills || !Array.isArray(skills)) return [];
  return skills.map(skill => {
    if (typeof skill === 'string') return skill;
    if (typeof skill === 'object' && skill.skill) return skill.skill;
    return '';
  }).filter(Boolean);
}

// Extract technology names
function extractTechNames(tech: TechItem[]): string[] {
  if (!tech || !Array.isArray(tech)) return [];
  return tech.map(t => t.technology || '').filter(Boolean);
}

// Calculate skill overlap
function calculateSkillsMatch(resumeSkills: string[], jobSkills: SkillItem[]): MatchBreakdown {
  const jobSkillNames = extractSkillNames(jobSkills);
  const matched: string[] = [];
  const missing: string[] = [];
  
  for (const jobSkill of jobSkillNames) {
    const hasMatch = resumeSkills.some(resumeSkill => 
      skillsMatch(resumeSkill, jobSkill)
    );
    
    if (hasMatch) {
      matched.push(jobSkill);
    } else {
      missing.push(jobSkill);
    }
  }
  
  // Weight by importance
  let weightedScore = 0;
  let totalWeight = 0;
  
  for (const jobSkill of jobSkills) {
    const skillName = typeof jobSkill === 'string' ? jobSkill : jobSkill.skill;
    const importance = typeof jobSkill === 'object' ? jobSkill.importance : 'medium';
    const weight = importance === 'high' ? 3 : importance === 'medium' ? 2 : 1;
    
    totalWeight += weight;
    if (matched.some(m => skillsMatch(m, skillName))) {
      weightedScore += weight;
    }
  }
  
  const score = totalWeight > 0 ? Math.round((weightedScore / totalWeight) * 100) : 0;
  
  return { score, matched, missing };
}

// Extract required years from job posting
function extractRequiredYears(experienceKeywords: ExperienceItem[]): number {
  if (!experienceKeywords || !Array.isArray(experienceKeywords)) return 0;
  
  for (const exp of experienceKeywords) {
    if (exp.yearsRequired) {
      const match = exp.yearsRequired.match(/(\d+)/);
      if (match) return parseInt(match[1]);
    }
    if (exp.keyword) {
      const match = exp.keyword.match(/(\d+)/);
      if (match) return parseInt(match[1]);
    }
  }
  
  return 0;
}

// Calculate experience match
function calculateExperienceMatch(
  resumeYears: number,
  jobExperience: ExperienceItem[]
): {
  score: number;
  resumeYears: number;
  requiredYears: number;
  relevantExperience: string[];
  missingExperience: string[];
} {
  const requiredYears = extractRequiredYears(jobExperience);
  
  if (requiredYears === 0) {
    return {
      score: 100,
      resumeYears,
      requiredYears,
      relevantExperience: ['No specific experience requirement'],
      missingExperience: []
    };
  }
  
  const yearsRatio = Math.min(resumeYears / requiredYears, 1.5);
  const score = Math.min(Math.round(yearsRatio * 100), 100);
  
  const relevantExperience: string[] = [];
  const missingExperience: string[] = [];
  
  if (resumeYears >= requiredYears) {
    relevantExperience.push(`${resumeYears} years of experience (meets ${requiredYears}+ requirement)`);
  } else {
    missingExperience.push(`Need ${requiredYears - resumeYears} more years of experience`);
  }
  
  return {
    score,
    resumeYears,
    requiredYears,
    relevantExperience,
    missingExperience
  };
}

// Education level hierarchy
const educationHierarchy: Record<string, number> = {
  'high school': 1,
  'ged': 1,
  'associates': 2,
  'bachelors': 3,
  'masters': 4,
  'phd': 5,
};

function getEducationLevel(edu: string): number {
  const lower = edu.toLowerCase();
  for (const [key, level] of Object.entries(educationHierarchy)) {
    if (lower.includes(key)) return level;
  }
  return 0;
}

// Calculate education match
function calculateEducationMatch(
  resumeEducationLevels: string[],
  jobEducation: string[] | EducationItem[]
): {
  score: number;
  matched: boolean;
  resumeEducation: string[];
  requiredEducation: string[];
  details: string;
} {
  const requiredEdu: string[] = [];
  
  if (Array.isArray(jobEducation)) {
    for (const edu of jobEducation) {
      if (typeof edu === 'string') {
        requiredEdu.push(edu);
      } else if (edu.level) {
        requiredEdu.push(edu.level);
      }
    }
  }
  
  if (requiredEdu.length === 0) {
    return {
      score: 100,
      matched: true,
      resumeEducation: resumeEducationLevels,
      requiredEducation: [],
      details: 'No specific education requirement'
    };
  }
  
  const resumeMaxLevel = Math.max(...resumeEducationLevels.map(getEducationLevel), 0);
  const requiredMaxLevel = Math.max(...requiredEdu.map(getEducationLevel), 0);
  
  const matched = resumeMaxLevel >= requiredMaxLevel;
  const score = matched ? 100 : (resumeMaxLevel > 0 ? Math.round((resumeMaxLevel / requiredMaxLevel) * 100) : 0);
  
  let details = matched ? 'Education requirement met' : 
    resumeMaxLevel > 0 ? `Have ${resumeEducationLevels[0]}, need ${requiredEdu[0]}` :
    `Missing required education: ${requiredEdu.join(', ')}`;
  
  return {
    score,
    matched,
    resumeEducation: resumeEducationLevels,
    requiredEducation: requiredEdu,
    details
  };
}

// Calculate technology match
function calculateTechnologiesMatch(
  resumeSkills: string[],
  jobTech: TechItem[]
): MatchBreakdown {
  const jobTechNames = extractTechNames(jobTech);
  const matched: string[] = [];
  const missing: string[] = [];
  
  for (const tech of jobTechNames) {
    const hasMatch = resumeSkills.some(skill => skillsMatch(skill, tech));
    if (hasMatch) {
      matched.push(tech);
    } else {
      missing.push(tech);
    }
  }
  
  const score = jobTechNames.length > 0 
    ? Math.round((matched.length / jobTechNames.length) * 100)
    : 100;
  
  return { score, matched, missing };
}

// Generate gaps and strengths
function generateGaps(
  skillsMatch: MatchBreakdown,
  experienceMatch: any,
  educationMatch: any,
  technologiesMatch: MatchBreakdown
): string[] {
  const gaps: string[] = [];
  
  if (skillsMatch.missing.length > 0) {
    gaps.push(`Missing key skills: ${skillsMatch.missing.slice(0, 3).join(', ')}`);
  }
  
  if (experienceMatch.missingExperience.length > 0) {
    gaps.push(...experienceMatch.missingExperience);
  }
  
  if (!educationMatch.matched && educationMatch.requiredEducation.length > 0) {
    gaps.push(`Education: ${educationMatch.details}`);
  }
  
  return gaps;
}

function generateStrengths(
  skillsMatch: MatchBreakdown,
  experienceMatch: any,
  educationMatch: any,
  technologiesMatch: MatchBreakdown
): string[] {
  const strengths: string[] = [];
  
  if (skillsMatch.matched.length > 0) {
    strengths.push(`Matched skills: ${skillsMatch.matched.slice(0, 5).join(', ')}`);
  }
  
  if (experienceMatch.score >= 100) {
    strengths.push(`Experience: ${experienceMatch.resumeYears}+ years`);
  }
  
  if (educationMatch.matched) {
    strengths.push('Education requirement met');
  }
  
  if (technologiesMatch.matched.length > 0) {
    strengths.push(`Technologies: ${technologiesMatch.matched.slice(0, 3).join(', ')}`);
  }
  
  return strengths;
}

function generateRecommendation(matchScore: number): string {
  if (matchScore >= 80) {
    return "Strong match! Tailor your resume to highlight matched skills.";
  } else if (matchScore >= 60) {
    return "Decent match. Emphasize transferable skills and address gaps.";
  } else if (matchScore >= 40) {
    return "Moderate gaps. Consider gaining additional skills or reframing experience.";
  } else {
    return "Significant gaps. Discuss with Lex about bridging them.";
  }
}

// ✅ MAIN FUNCTION - Now uses extractedText!
export function calculateMatchScore(
  resume: ResumeData,
  jobAtsKeywords: JobData
): MatchResult {
  console.log('🔍 Calculating match with extracted text...');
  
  // ✅ Parse the actual resume text content!
  const parsed = parseResumeText(resume.extractedText || '');
  
  console.log('📊 Parsed resume:', {
    skills: parsed.skills.length,
    years: parsed.experienceYears,
    education: parsed.educationLevels
  });
  
  // Use parsed data
  const resumeSkills = parsed.skills;
  const resumeYears = parsed.experienceYears;
  const resumeEducation = parsed.educationLevels;
  
  // Calculate each category
  const skillsMatch = calculateSkillsMatch(resumeSkills, jobAtsKeywords.hardSkills);
  const experienceMatch = calculateExperienceMatch(resumeYears, jobAtsKeywords.experienceKeywords);
  const educationMatch = calculateEducationMatch(resumeEducation, jobAtsKeywords.educationRequirements);
  const technologiesMatch = calculateTechnologiesMatch(resumeSkills, jobAtsKeywords.technologies);
  const softSkillsMatch = calculateSkillsMatch(resumeSkills, jobAtsKeywords.softSkills);
  
  // Weighted score: Skills 35%, Experience 25%, Education 15%, Tech 20%, Soft 5%
  const matchScore = Math.round(
    (skillsMatch.score * 0.35) +
    (experienceMatch.score * 0.25) +
    (educationMatch.score * 0.15) +
    (technologiesMatch.score * 0.20) +
    (softSkillsMatch.score * 0.05)
  );
  
  const gaps = generateGaps(skillsMatch, experienceMatch, educationMatch, technologiesMatch);
  const strengths = generateStrengths(skillsMatch, experienceMatch, educationMatch, technologiesMatch);
  const recommendation = generateRecommendation(matchScore);
  
  console.log('✅ Match calculated:', matchScore, '/ 100');
  
  return {
    matchScore,
    skillsMatch,
    experienceMatch,
    educationMatch,
    technologiesMatch,
    gaps,
    strengths,
    recommendation
  };
}

export default calculateMatchScore;