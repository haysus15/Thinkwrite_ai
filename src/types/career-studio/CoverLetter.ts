// Cover Letter Types for Career Studio
// src/types/career-studio/CoverLetter.ts

export type CoverLetterTone = 'professional' | 'enthusiastic' | 'confident' | 'conversational' | 'formal';
export type CoverLetterLength = 'short' | 'medium' | 'long';
export type GenerationStatus = 'pending' | 'generating' | 'completed' | 'failed';

export interface CoverLetter {
  id: string;
  userId: string;
  jobAnalysisId?: string;
  resumeId?: string;

  // Content
  title: string;
  content: string;
  contentHtml?: string;

  // Target info
  targetCompany: string;
  targetRole: string;
  hiringManagerName?: string;

  // Generation settings
  tone: CoverLetterTone;
  length: CoverLetterLength;
  emphasize?: string[];
  avoidMentioning?: string[];

  // Generation metadata
  generationStatus: GenerationStatus;
  generatedAt?: string;
  regeneratedCount: number;
  lexFeedback?: LexCoverLetterFeedback;

  // Versions
  versions?: CoverLetterVersion[];
  currentVersionIndex: number;

  // Status
  isFavorite: boolean;
  isUsed: boolean;
  usedForApplicationId?: string;

  // Metadata
  wordCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CoverLetterVersion {
  id: string;
  content: string;
  tone: CoverLetterTone;
  length: CoverLetterLength;
  createdAt: string;
  notes?: string;
}

export interface LexCoverLetterFeedback {
  overallScore: number;
  strengths: string[];
  improvements: CoverLetterImprovement[];
  suggestions: string[];
  toneAnalysis: {
    current: CoverLetterTone;
    appropriateness: 'perfect' | 'good' | 'could_improve';
    notes?: string;
  };
  keywordMatch?: {
    included: string[];
    missing: string[];
    score: number;
  };
}

export interface CoverLetterImprovement {
  section: 'opening' | 'body' | 'closing' | 'overall';
  issue: string;
  suggestion: string;
  example?: string;
  priority: 'high' | 'medium' | 'low';
}

export interface GenerateCoverLetterRequest {
  userId: string;
  jobAnalysisId?: string;
  resumeId?: string;
  targetCompany: string;
  targetRole: string;
  hiringManagerName?: string;
  tone?: CoverLetterTone;
  length?: CoverLetterLength;
  emphasize?: string[];
  avoidMentioning?: string[];
  additionalContext?: string;
  useVoiceProfile?: boolean;
}

export interface GenerateCoverLetterResponse {
  success: boolean;
  coverLetter?: CoverLetter;
  error?: string;
  lexNotes?: string;
}

export interface RegenerateCoverLetterRequest {
  coverLetterId: string;
  feedback?: string;
  tone?: CoverLetterTone;
  length?: CoverLetterLength;
  keepParagraphs?: number[];
}

// Database types
export interface CoverLetterDB {
  id: string;
  user_id: string;
  job_analysis_id?: string;
  resume_id?: string;
  title: string;
  content: string;
  content_html?: string;
  target_company: string;
  target_role: string;
  hiring_manager_name?: string;
  tone: CoverLetterTone;
  length: CoverLetterLength;
  emphasize?: string[];
  avoid_mentioning?: string[];
  generation_status: GenerationStatus;
  generated_at?: string;
  regenerated_count: number;
  lex_feedback?: LexCoverLetterFeedback;
  versions?: CoverLetterVersion[];
  current_version_index: number;
  is_favorite: boolean;
  is_used: boolean;
  used_for_application_id?: string;
  word_count: number;
  created_at: string;
  updated_at: string;
}

// Transform functions
export function transformCoverLetterFromDB(db: CoverLetterDB): CoverLetter {
  return {
    id: db.id,
    userId: db.user_id,
    jobAnalysisId: db.job_analysis_id,
    resumeId: db.resume_id,
    title: db.title,
    content: db.content,
    contentHtml: db.content_html,
    targetCompany: db.target_company,
    targetRole: db.target_role,
    hiringManagerName: db.hiring_manager_name,
    tone: db.tone,
    length: db.length,
    emphasize: db.emphasize,
    avoidMentioning: db.avoid_mentioning,
    generationStatus: db.generation_status,
    generatedAt: db.generated_at,
    regeneratedCount: db.regenerated_count,
    lexFeedback: db.lex_feedback,
    versions: db.versions,
    currentVersionIndex: db.current_version_index,
    isFavorite: db.is_favorite,
    isUsed: db.is_used,
    usedForApplicationId: db.used_for_application_id,
    wordCount: db.word_count,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  };
}

export function transformCoverLetterToDB(coverLetter: Partial<CoverLetter>): Partial<CoverLetterDB> {
  const db: Partial<CoverLetterDB> = {};

  if (coverLetter.userId) db.user_id = coverLetter.userId;
  if (coverLetter.jobAnalysisId !== undefined) db.job_analysis_id = coverLetter.jobAnalysisId;
  if (coverLetter.resumeId !== undefined) db.resume_id = coverLetter.resumeId;
  if (coverLetter.title !== undefined) db.title = coverLetter.title;
  if (coverLetter.content !== undefined) db.content = coverLetter.content;
  if (coverLetter.contentHtml !== undefined) db.content_html = coverLetter.contentHtml;
  if (coverLetter.targetCompany !== undefined) db.target_company = coverLetter.targetCompany;
  if (coverLetter.targetRole !== undefined) db.target_role = coverLetter.targetRole;
  if (coverLetter.hiringManagerName !== undefined) db.hiring_manager_name = coverLetter.hiringManagerName;
  if (coverLetter.tone !== undefined) db.tone = coverLetter.tone;
  if (coverLetter.length !== undefined) db.length = coverLetter.length;
  if (coverLetter.emphasize !== undefined) db.emphasize = coverLetter.emphasize;
  if (coverLetter.avoidMentioning !== undefined) db.avoid_mentioning = coverLetter.avoidMentioning;
  if (coverLetter.generationStatus !== undefined) db.generation_status = coverLetter.generationStatus;
  if (coverLetter.generatedAt !== undefined) db.generated_at = coverLetter.generatedAt;
  if (coverLetter.regeneratedCount !== undefined) db.regenerated_count = coverLetter.regeneratedCount;
  if (coverLetter.lexFeedback !== undefined) db.lex_feedback = coverLetter.lexFeedback;
  if (coverLetter.versions !== undefined) db.versions = coverLetter.versions;
  if (coverLetter.currentVersionIndex !== undefined) db.current_version_index = coverLetter.currentVersionIndex;
  if (coverLetter.isFavorite !== undefined) db.is_favorite = coverLetter.isFavorite;
  if (coverLetter.isUsed !== undefined) db.is_used = coverLetter.isUsed;
  if (coverLetter.usedForApplicationId !== undefined) db.used_for_application_id = coverLetter.usedForApplicationId;
  if (coverLetter.wordCount !== undefined) db.word_count = coverLetter.wordCount;

  return db;
}

// Helper to generate unique ID
export function generateCoverLetterId(): string {
  return `cl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Tone descriptions for UI
export const TONE_DESCRIPTIONS: Record<CoverLetterTone, string> = {
  professional: 'Polished and business-appropriate, ideal for corporate roles',
  enthusiastic: 'Energetic and passionate, great for startups and creative roles',
  confident: 'Bold and assertive, best for leadership positions',
  conversational: 'Friendly and approachable, suitable for culture-focused companies',
  formal: 'Traditional and structured, appropriate for conservative industries',
};

// Length descriptions for UI
export const LENGTH_DESCRIPTIONS: Record<CoverLetterLength, {
  label: string;
  paragraphs: string;
  wordRange: string;
}> = {
  short: {
    label: 'Concise',
    paragraphs: '2-3 paragraphs',
    wordRange: '150-200 words',
  },
  medium: {
    label: 'Standard',
    paragraphs: '3-4 paragraphs',
    wordRange: '250-350 words',
  },
  long: {
    label: 'Detailed',
    paragraphs: '4-5 paragraphs',
    wordRange: '400-500 words',
  },
};
