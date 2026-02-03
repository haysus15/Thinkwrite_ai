// Resume Types for Career Studio
// src/types/career-studio/Resume.ts

export type ResumeSource = 'upload' | 'builder' | 'import';
export type ResumeFormat = 'docx' | 'pdf' | 'txt';

export interface Resume {
  id: string;
  userId: string;
  title: string;
  source: ResumeSource;
  format?: ResumeFormat;

  // File info (for uploads)
  fileName?: string;
  fileSize?: number;
  filePath?: string;

  // Parsed content
  rawText?: string;
  parsedContent?: ParsedResumeContent;

  // Analysis
  atsScore?: number;
  analysis?: ResumeAnalysis;
  lastAnalyzedAt?: string;

  // Metadata
  isMaster: boolean;
  isActive: boolean;
  tags?: string[];
  notes?: string;

  createdAt: string;
  updatedAt: string;
}

export interface ParsedResumeContent {
  contactInfo?: {
    name?: string;
    email?: string;
    phone?: string;
    location?: string;
    linkedin?: string;
    website?: string;
  };
  summary?: string;
  experience?: ExperienceItem[];
  education?: EducationItem[];
  skills?: SkillGroup[];
  certifications?: CertificationItem[];
  projects?: ProjectItem[];
  languages?: LanguageItem[];
  awards?: AwardItem[];
}

export interface ExperienceItem {
  id: string;
  title: string;
  company: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  isCurrent?: boolean;
  description?: string;
  bullets?: string[];
  achievements?: string[];
}

export interface EducationItem {
  id: string;
  degree: string;
  institution: string;
  location?: string;
  graduationDate?: string;
  gpa?: string;
  honors?: string[];
  relevantCoursework?: string[];
}

export interface SkillGroup {
  id: string;
  category: string;
  skills: string[];
}

export interface CertificationItem {
  id: string;
  name: string;
  issuer: string;
  issueDate?: string;
  expirationDate?: string;
  credentialId?: string;
  url?: string;
}

export interface ProjectItem {
  id: string;
  name: string;
  description?: string;
  role?: string;
  technologies?: string[];
  url?: string;
  startDate?: string;
  endDate?: string;
  bullets?: string[];
}

export interface LanguageItem {
  language: string;
  proficiency: 'native' | 'fluent' | 'advanced' | 'intermediate' | 'beginner';
}

export interface AwardItem {
  id: string;
  name: string;
  issuer?: string;
  date?: string;
  description?: string;
}

export interface ResumeAnalysis {
  overallScore: number;
  sections: {
    contact: SectionScore;
    summary: SectionScore;
    experience: SectionScore;
    education: SectionScore;
    skills: SectionScore;
  };
  strengths: string[];
  improvements: ImprovementSuggestion[];
  keywords: KeywordAnalysis;
  formatting: FormattingAnalysis;
  estimatedExperience?: number;
  seniorityLevel?: 'entry' | 'mid' | 'senior' | 'executive';
}

export interface SectionScore {
  score: number;
  present: boolean;
  feedback?: string;
}

export interface ImprovementSuggestion {
  section: string;
  issue: string;
  suggestion: string;
  priority: 'high' | 'medium' | 'low';
  example?: string;
}

export interface KeywordAnalysis {
  topKeywords: string[];
  missingKeywords?: string[];
  keywordDensity?: Record<string, number>;
}

export interface FormattingAnalysis {
  hasBulletPoints: boolean;
  hasActionVerbs: boolean;
  hasQuantifiableResults: boolean;
  hasConsistentFormatting: boolean;
  wordCount: number;
  issues?: string[];
}

// Database types
export interface ResumeDB {
  id: string;
  user_id: string;
  title: string;
  source: ResumeSource;
  format?: ResumeFormat;
  file_name?: string;
  file_size?: number;
  file_path?: string;
  raw_text?: string;
  parsed_content?: ParsedResumeContent;
  ats_score?: number;
  analysis?: ResumeAnalysis;
  last_analyzed_at?: string;
  is_master: boolean;
  is_active: boolean;
  tags?: string[];
  notes?: string;
  created_at: string;
  updated_at: string;
}

// Transform functions
export function transformResumeFromDB(db: ResumeDB): Resume {
  return {
    id: db.id,
    userId: db.user_id,
    title: db.title,
    source: db.source,
    format: db.format,
    fileName: db.file_name,
    fileSize: db.file_size,
    filePath: db.file_path,
    rawText: db.raw_text,
    parsedContent: db.parsed_content,
    atsScore: db.ats_score,
    analysis: db.analysis,
    lastAnalyzedAt: db.last_analyzed_at,
    isMaster: db.is_master,
    isActive: db.is_active,
    tags: db.tags,
    notes: db.notes,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  };
}

export function transformResumeToDB(resume: Partial<Resume>): Partial<ResumeDB> {
  const db: Partial<ResumeDB> = {};

  if (resume.userId) db.user_id = resume.userId;
  if (resume.title !== undefined) db.title = resume.title;
  if (resume.source !== undefined) db.source = resume.source;
  if (resume.format !== undefined) db.format = resume.format;
  if (resume.fileName !== undefined) db.file_name = resume.fileName;
  if (resume.fileSize !== undefined) db.file_size = resume.fileSize;
  if (resume.filePath !== undefined) db.file_path = resume.filePath;
  if (resume.rawText !== undefined) db.raw_text = resume.rawText;
  if (resume.parsedContent !== undefined) db.parsed_content = resume.parsedContent;
  if (resume.atsScore !== undefined) db.ats_score = resume.atsScore;
  if (resume.analysis !== undefined) db.analysis = resume.analysis;
  if (resume.lastAnalyzedAt !== undefined) db.last_analyzed_at = resume.lastAnalyzedAt;
  if (resume.isMaster !== undefined) db.is_master = resume.isMaster;
  if (resume.isActive !== undefined) db.is_active = resume.isActive;
  if (resume.tags !== undefined) db.tags = resume.tags;
  if (resume.notes !== undefined) db.notes = resume.notes;

  return db;
}

// Helper to generate unique ID
export function generateResumeId(): string {
  return `resume_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
