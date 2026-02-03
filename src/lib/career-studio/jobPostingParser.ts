// Job Posting Parser Utilities
// src/lib/career-studio/jobPostingParser.ts

export interface ParsedJobPosting {
  title: string;
  company: string;
  location: string | null;
  salary: SalaryInfo | null;
  jobType: string | null;
  workMode: 'remote' | 'hybrid' | 'onsite' | null;
  experience: ExperienceRequirement | null;
  education: string[];
  requirements: string[];
  responsibilities: string[];
  benefits: string[];
  skills: ExtractedSkill[];
  applicationInfo: ApplicationInfo;
  metadata: PostingMetadata;
}

export interface SalaryInfo {
  min: number | null;
  max: number | null;
  currency: string;
  period: 'hourly' | 'annual' | 'monthly';
  raw: string;
}

export interface ExperienceRequirement {
  minYears: number;
  maxYears: number | null;
  level: 'entry' | 'mid' | 'senior' | 'executive';
  raw: string;
}

export interface ExtractedSkill {
  name: string;
  type: 'technical' | 'soft' | 'tool' | 'certification';
  required: boolean;
}

export interface ApplicationInfo {
  email: string | null;
  url: string | null;
  deadline: string | null;
}

export interface PostingMetadata {
  wordCount: number;
  hasStructuredSections: boolean;
  estimatedQuality: number;
  postedDate: string | null;
}

// Salary parsing patterns
const SALARY_PATTERNS = [
  /\$\s*([\d,]+)\s*[-–—to]+\s*\$?\s*([\d,]+)\s*(?:per\s+)?(year|annually|yr|hour|hourly|hr|month|monthly)?/i,
  /\$\s*([\d,]+)\s*(?:per\s+)?(year|annually|yr|hour|hourly|hr|month|monthly)/i,
  /([\d,]+)\s*[-–—]\s*([\d,]+)\s*([kK])\s*(?:per\s+)?(year|annually)?/i,
  /salary[:\s]+\$?\s*([\d,]+)\s*[-–—to]+\s*\$?\s*([\d,]+)/i,
];

// Experience level patterns
const EXPERIENCE_PATTERNS = [
  /(\d+)\+?\s*[-–—to]+\s*(\d+)\s*years?\s*(?:of\s+)?(?:experience|exp)/i,
  /(\d+)\+?\s*years?\s*(?:of\s+)?(?:experience|exp)/i,
  /minimum\s+(?:of\s+)?(\d+)\s*years?/i,
  /at\s+least\s+(\d+)\s*years?/i,
];

// Work mode patterns
const WORK_MODE_PATTERNS: { pattern: RegExp; mode: 'remote' | 'hybrid' | 'onsite' }[] = [
  { pattern: /\b(fully\s+)?remote\b/i, mode: 'remote' },
  { pattern: /\b(100%|completely)\s+remote\b/i, mode: 'remote' },
  { pattern: /\bhybrid\b/i, mode: 'hybrid' },
  { pattern: /\b(in-?office|on-?site|in-?person)\b/i, mode: 'onsite' },
];

// Section headers for parsing
const SECTION_PATTERNS: Record<string, RegExp[]> = {
  requirements: [
    /^requirements?:?$/i,
    /^qualifications?:?$/i,
    /^what\s+you('ll)?\s+need:?$/i,
    /^you\s+have:?$/i,
    /^must\s+have:?$/i,
  ],
  responsibilities: [
    /^responsibilities?:?$/i,
    /^duties:?$/i,
    /^what\s+you('ll)?\s+do:?$/i,
    /^the\s+role:?$/i,
    /^key\s+responsibilities?:?$/i,
  ],
  benefits: [
    /^benefits?:?$/i,
    /^perks?:?$/i,
    /^what\s+we\s+offer:?$/i,
    /^why\s+join\s+us:?$/i,
    /^compensation:?$/i,
  ],
  about: [
    /^about\s+(us|the\s+company):?$/i,
    /^who\s+we\s+are:?$/i,
    /^company\s+overview:?$/i,
  ],
};

/**
 * Parse salary information from job posting text
 */
export function parseSalary(text: string): SalaryInfo | null {
  for (const pattern of SALARY_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      let min: number | null = null;
      let max: number | null = null;
      let period: SalaryInfo['period'] = 'annual';

      // Parse numbers, handling 'k' suffix
      const num1 = match[1]?.replace(/,/g, '');
      const num2 = match[2]?.replace(/,/g, '');
      const hasK = match[3]?.toLowerCase() === 'k';
      const periodText = (match[4] || match[3] || '').toLowerCase();

      if (num1) {
        min = parseInt(num1) * (hasK ? 1000 : 1);
      }
      if (num2 && !['k', 'year', 'annually', 'yr', 'hour', 'hourly', 'hr', 'month', 'monthly'].includes(num2.toLowerCase())) {
        max = parseInt(num2) * (hasK ? 1000 : 1);
      }

      // Determine period
      if (periodText.includes('hour') || periodText === 'hr') {
        period = 'hourly';
      } else if (periodText.includes('month')) {
        period = 'monthly';
      }

      return {
        min,
        max,
        currency: 'USD',
        period,
        raw: match[0],
      };
    }
  }

  return null;
}

/**
 * Parse experience requirements from job posting text
 */
export function parseExperience(text: string): ExperienceRequirement | null {
  for (const pattern of EXPERIENCE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const minYears = parseInt(match[1]);
      const maxYears = match[2] ? parseInt(match[2]) : null;

      // Determine level based on years
      let level: ExperienceRequirement['level'] = 'mid';
      if (minYears <= 2) level = 'entry';
      else if (minYears >= 8) level = 'executive';
      else if (minYears >= 5) level = 'senior';

      return {
        minYears,
        maxYears,
        level,
        raw: match[0],
      };
    }
  }

  // Check for level-based requirements
  const levelPatterns: { pattern: RegExp; level: ExperienceRequirement['level']; minYears: number }[] = [
    { pattern: /\b(entry[\s-]?level|junior|associate)\b/i, level: 'entry', minYears: 0 },
    { pattern: /\b(mid[\s-]?level|intermediate)\b/i, level: 'mid', minYears: 3 },
    { pattern: /\b(senior|sr\.?|lead)\b/i, level: 'senior', minYears: 5 },
    { pattern: /\b(executive|director|vp|chief)\b/i, level: 'executive', minYears: 10 },
  ];

  for (const { pattern, level, minYears } of levelPatterns) {
    if (pattern.test(text)) {
      return {
        minYears,
        maxYears: null,
        level,
        raw: text.match(pattern)?.[0] || '',
      };
    }
  }

  return null;
}

/**
 * Detect work mode from job posting text
 */
export function parseWorkMode(text: string): 'remote' | 'hybrid' | 'onsite' | null {
  for (const { pattern, mode } of WORK_MODE_PATTERNS) {
    if (pattern.test(text)) {
      return mode;
    }
  }
  return null;
}

/**
 * Extract job title from posting text
 */
export function extractTitle(text: string): string {
  const lines = text.split('\n').filter(line => line.trim());

  // First non-empty line is often the title
  if (lines.length > 0) {
    const firstLine = lines[0].trim();
    // Title is usually short and doesn't have common non-title words
    if (firstLine.length < 100 && !firstLine.includes(':') && !firstLine.includes('.')) {
      return firstLine;
    }
  }

  // Look for common title patterns
  const titlePatterns = [
    /(?:job\s+)?title[:\s]+(.+)/i,
    /(?:position|role)[:\s]+(.+)/i,
    /hiring[:\s]+(.+)/i,
  ];

  for (const pattern of titlePatterns) {
    const match = text.match(pattern);
    if (match && match[1].length < 100) {
      return match[1].trim();
    }
  }

  return 'Unknown Position';
}

/**
 * Extract company name from posting text
 */
export function extractCompany(text: string): string {
  // Common patterns for company name
  const companyPatterns = [
    /(?:company|employer)[:\s]+(.+)/i,
    /(?:about|join)\s+(.+?)(?:\s+is|\s+are|\s*-|$)/i,
    /at\s+([A-Z][A-Za-z0-9\s&]+?)(?:\s+is|\s+are|,|$)/,
  ];

  for (const pattern of companyPatterns) {
    const match = text.match(pattern);
    if (match && match[1].length < 100) {
      return match[1].trim();
    }
  }

  return 'Unknown Company';
}

/**
 * Extract location from posting text
 */
export function extractLocation(text: string): string | null {
  // Common US city/state patterns
  const locationPatterns = [
    /(?:location|based\s+in)[:\s]+(.+)/i,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z]{2})\b/,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*(?:United\s+States|USA|US)\b/i,
  ];

  for (const pattern of locationPatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0].includes(':') ? match[1].trim() : match[0].trim();
    }
  }

  return null;
}

/**
 * Extract skills from job posting text
 */
export function extractSkills(text: string): ExtractedSkill[] {
  const skills: ExtractedSkill[] = [];
  const textLower = text.toLowerCase();

  // Technical skills
  const technicalSkills = [
    'python', 'javascript', 'typescript', 'java', 'c++', 'c#', 'ruby', 'go', 'rust', 'php', 'swift', 'kotlin',
    'react', 'angular', 'vue', 'node.js', 'express', 'django', 'flask', 'spring', 'rails', 'next.js',
    'sql', 'mysql', 'postgresql', 'mongodb', 'redis', 'elasticsearch', 'dynamodb',
    'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform', 'jenkins', 'git', 'github', 'gitlab',
    'html', 'css', 'sass', 'less', 'tailwind', 'bootstrap',
    'rest api', 'graphql', 'microservices', 'ci/cd', 'devops',
  ];

  // Soft skills
  const softSkills = [
    'leadership', 'communication', 'teamwork', 'problem solving', 'analytical',
    'project management', 'time management', 'critical thinking', 'collaboration',
    'presentation', 'negotiation', 'strategic planning', 'mentoring', 'coaching',
  ];

  // Tools
  const tools = [
    'excel', 'powerpoint', 'word', 'outlook', 'teams', 'slack', 'zoom',
    'jira', 'confluence', 'asana', 'trello', 'notion',
    'salesforce', 'hubspot', 'zendesk',
    'tableau', 'power bi', 'looker',
    'figma', 'sketch', 'adobe', 'photoshop', 'illustrator',
  ];

  // Check if mentioned
  for (const skill of technicalSkills) {
    if (textLower.includes(skill)) {
      skills.push({
        name: skill,
        type: 'technical',
        required: /required|must\s+have|essential/i.test(text.substring(
          Math.max(0, textLower.indexOf(skill) - 50),
          textLower.indexOf(skill) + 50
        )),
      });
    }
  }

  for (const skill of softSkills) {
    if (textLower.includes(skill)) {
      skills.push({
        name: skill,
        type: 'soft',
        required: false,
      });
    }
  }

  for (const tool of tools) {
    if (textLower.includes(tool)) {
      skills.push({
        name: tool,
        type: 'tool',
        required: /required|must\s+have|proficient/i.test(text.substring(
          Math.max(0, textLower.indexOf(tool) - 50),
          textLower.indexOf(tool) + 50
        )),
      });
    }
  }

  return skills;
}

/**
 * Extract application information
 */
export function extractApplicationInfo(text: string): ApplicationInfo {
  const info: ApplicationInfo = {
    email: null,
    url: null,
    deadline: null,
  };

  // Email
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) {
    info.email = emailMatch[0];
  }

  // URL (apply link)
  const urlMatch = text.match(/apply\s+(?:at|here)[:\s]*(https?:\/\/[^\s]+)/i);
  if (urlMatch) {
    info.url = urlMatch[1];
  }

  // Deadline
  const deadlinePatterns = [
    /(?:deadline|apply\s+by|closes?)[:\s]*([A-Za-z]+\s+\d{1,2},?\s*\d{4})/i,
    /(?:deadline|apply\s+by|closes?)[:\s]*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
  ];

  for (const pattern of deadlinePatterns) {
    const match = text.match(pattern);
    if (match) {
      info.deadline = match[1];
      break;
    }
  }

  return info;
}

/**
 * Extract bullet points from a section of text
 */
export function extractBulletPoints(text: string): string[] {
  const lines = text.split('\n');
  const bullets: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Match various bullet styles
    const bulletMatch = trimmed.match(/^(?:[•\-\*\u2022\u2023\u25E6\u2043]|\d+\.|\([a-z]\))\s*(.+)/);
    if (bulletMatch) {
      bullets.push(bulletMatch[1].trim());
    } else if (trimmed.length > 10 && trimmed.length < 500 && !trimmed.endsWith(':')) {
      // Lines that look like items
      bullets.push(trimmed);
    }
  }

  return bullets;
}

/**
 * Calculate posting quality score
 */
export function calculatePostingQuality(posting: ParsedJobPosting): number {
  let score = 0;

  // Title and company present
  if (posting.title && posting.title !== 'Unknown Position') score += 10;
  if (posting.company && posting.company !== 'Unknown Company') score += 10;

  // Salary transparency
  if (posting.salary) score += 15;

  // Location/work mode clarity
  if (posting.location) score += 5;
  if (posting.workMode) score += 5;

  // Requirements clarity
  if (posting.requirements.length >= 3) score += 10;
  if (posting.responsibilities.length >= 3) score += 10;

  // Benefits listed
  if (posting.benefits.length > 0) score += 10;

  // Experience requirements clear
  if (posting.experience) score += 5;

  // Skills mentioned
  if (posting.skills.length >= 5) score += 10;

  // Application info
  if (posting.applicationInfo.email || posting.applicationInfo.url) score += 10;

  return Math.min(score, 100);
}

/**
 * Full job posting parser
 */
export function parseJobPosting(text: string): ParsedJobPosting {
  const title = extractTitle(text);
  const company = extractCompany(text);
  const location = extractLocation(text);
  const salary = parseSalary(text);
  const workMode = parseWorkMode(text);
  const experience = parseExperience(text);
  const skills = extractSkills(text);
  const applicationInfo = extractApplicationInfo(text);

  // Extract education requirements
  const educationPatterns = [
    /bachelor'?s?\s+(?:degree)?(?:\s+in\s+[A-Za-z\s]+)?/gi,
    /master'?s?\s+(?:degree)?(?:\s+in\s+[A-Za-z\s]+)?/gi,
    /phd|doctorate/gi,
    /\b(?:bs|ba|ms|ma|mba)\b/gi,
  ];

  const education: string[] = [];
  for (const pattern of educationPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      education.push(...matches.map(m => m.trim()));
    }
  }

  // Parse job type
  let jobType: string | null = null;
  if (/full[\s-]?time/i.test(text)) jobType = 'Full-time';
  else if (/part[\s-]?time/i.test(text)) jobType = 'Part-time';
  else if (/contract/i.test(text)) jobType = 'Contract';
  else if (/temporary/i.test(text)) jobType = 'Temporary';
  else if (/freelance/i.test(text)) jobType = 'Freelance';

  // Extract requirements and responsibilities
  const requirements = extractBulletPoints(text.match(/requirements?:?\s*([\s\S]*?)(?=responsibilities?:|benefits?:|about|$)/i)?.[1] || '');
  const responsibilities = extractBulletPoints(text.match(/responsibilities?:?\s*([\s\S]*?)(?=requirements?:|benefits?:|about|$)/i)?.[1] || '');
  const benefits = extractBulletPoints(text.match(/benefits?:?\s*([\s\S]*?)(?=requirements?:|responsibilities?:|about|$)/i)?.[1] || '');

  const posting: ParsedJobPosting = {
    title,
    company,
    location,
    salary,
    jobType,
    workMode,
    experience,
    education: [...new Set(education)],
    requirements,
    responsibilities,
    benefits,
    skills,
    applicationInfo,
    metadata: {
      wordCount: text.split(/\s+/).filter(Boolean).length,
      hasStructuredSections: requirements.length > 0 || responsibilities.length > 0,
      estimatedQuality: 0,
      postedDate: null,
    },
  };

  posting.metadata.estimatedQuality = calculatePostingQuality(posting);

  return posting;
}

/**
 * Clean and normalize job posting text
 */
export function normalizeJobText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/ +/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
