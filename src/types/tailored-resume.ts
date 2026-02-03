// Tailored Resume Types
// src/types/tailored-resume.ts

export type TailoringLevel = 'light' | 'medium' | 'heavy';
export type ChangeStatus = 'pending' | 'accepted' | 'rejected';
export type ChangeImpact = 'high' | 'medium' | 'low';
export type ResumeSection = 'summary' | 'experience' | 'skills' | 'education' | 'certifications' | 'projects' | 'other';
export type HonestyFlag = 'SAFE' | 'QUESTIONABLE' | 'DISHONEST' | 'PENDING'; // 🆕

// Individual change tracking
export interface ResumeChange {
  id: string;
  section: ResumeSection;
  subsection?: string; // e.g., "job-1-bullet-2" or "skill-group-technical"
  sectionIndex?: number; // For ordering within section
  original: string;
  tailored: string;
  reason: string;
  impact: ChangeImpact;
  status: ChangeStatus;
  lexTip: string;
  keywords?: string[]; // ATS keywords this change addresses
  acceptedAt?: string;
  rejectedAt?: string;
  
  // 🆕 Honesty and conversation features
  requiresConversation?: boolean; // True if needs clarification
  conversationQuestion?: string; // What to ask user
  honestyFlag?: HonestyFlag; // Safety rating from Lex
  conversationContext?: string; // For conversation-extracted changes
}

// Structured resume content
export interface ResumeSection_Summary {
  type: 'summary';
  content: string;
}

export interface ResumeSection_Experience {
  type: 'experience';
  jobs: Array<{
    id: string;
    title: string;
    company: string;
    location?: string;
    startDate: string;
    endDate?: string;
    current?: boolean;
    bullets: Array<{
      id: string;
      content: string;
    }>;
  }>;
}

export interface ResumeSection_Skills {
  type: 'skills';
  groups: Array<{
    id: string;
    category: string;
    skills: string[];
  }>;
}

export interface ResumeSection_Education {
  type: 'education';
  entries: Array<{
    id: string;
    degree: string;
    institution: string;
    location?: string;
    graduationDate?: string;
    gpa?: string;
    honors?: string[];
    relevantCoursework?: string[];
  }>;
}

export interface ResumeSection_Certifications {
  type: 'certifications';
  entries: Array<{
    id: string;
    name: string;
    issuer: string;
    date?: string;
    expirationDate?: string;
  }>;
}

export interface ResumeSection_Projects {
  type: 'projects';
  entries: Array<{
    id: string;
    name: string;
    description: string;
    technologies?: string[];
    url?: string;
    bullets?: Array<{
      id: string;
      content: string;
    }>;
  }>;
}

// Full structured resume content
export interface StructuredResumeContent {
  contactInfo?: {
    name: string;
    email?: string;
    phone?: string;
    location?: string;
    linkedin?: string;
    website?: string;
  };
  summary?: ResumeSection_Summary;
  experience?: ResumeSection_Experience;
  skills?: ResumeSection_Skills;
  education?: ResumeSection_Education;
  certifications?: ResumeSection_Certifications;
  projects?: ResumeSection_Projects;
  other?: Array<{
    id: string;
    sectionTitle: string;
    content: string;
  }>;
}

// Lex commentary structure
export interface LexCommentary {
  overallAssessment: string;
  tailoringStrategy: string;
  keyImprovements: string[];
  honestFeedback: string; // What they might need to actually develop/learn
  interviewTips: string[];
  perChangeComments: Record<string, string>; // changeId -> comment
  
  // 🆕 Honesty and conversation features
  honestyReport?: string; // Overall honesty assessment
  recommendConversation?: boolean; // Should user chat with Lex first?
  conversationTopics?: string[]; // Topics to discuss if recommended
}

// 🆕 Gap identification
export interface ResumeGap {
  requirement: string; // What the job needs
  gap: string; // What candidate lacks
  recommendation: string; // How to address strategically
}

// Main tailored resume record
export interface TailoredResume {
  id: string;
  userId: string;
  jobAnalysisId: string;
  masterResumeId: string;
  
  // Versioning
  versionNumber: number;
  versionName?: string;
  
  // Configuration
  tailoringLevel: TailoringLevel;
  
  // Content
  originalContent: StructuredResumeContent;
  tailoredContent: StructuredResumeContent;
  changes: ResumeChange[];
  
  // Change tracking
  changesAccepted: number;
  changesRejected: number;
  changesPending: number;
  
  // Lex integration
  lexCommentary: LexCommentary;
  lexOverallAssessment?: string;
  
  // 🆕 Honesty features
  gaps?: ResumeGap[]; // Honest gap assessment
  
  // Status
  isFinalized: boolean;
  finalizedAt?: string;
  
  // Generated document
  filePath?: string;
  fileGeneratedAt?: string;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}

// Database record (snake_case)
export interface TailoredResumeDB {
  id: string;
  user_id: string;
  job_analysis_id: string;
  master_resume_id: string;
  version_number: number;
  version_name?: string;
  tailoring_level: TailoringLevel;
  original_content: StructuredResumeContent;
  tailored_content: StructuredResumeContent;
  changes: ResumeChange[];
  changes_accepted: number;
  changes_rejected: number;
  changes_pending: number;
  lex_commentary: LexCommentary;
  lex_overall_assessment?: string;
  gaps?: ResumeGap[]; // 🆕
  is_finalized: boolean;
  finalized_at?: string;
  file_path?: string;
  file_generated_at?: string;
  created_at: string;
  updated_at: string;
}

// 🆕 Conversation extraction types
export interface ConversationInsights {
  userGoal: string; // What user actually wants
  careerStrategy: string; // Strategy from conversation
  keyReframes: string[]; // Top strategic reframes
}

export interface ExtractedSuggestion {
  section: ResumeSection;
  subsection?: string;
  original: string;
  suggested: string;
  reason: string;
  conversationContext: string; // Key insight from conversation
  honestyFlag: HonestyFlag;
  impact: ChangeImpact;
  keywords: string[];
}

export interface ConversationExtractionResult {
  success: boolean;
  suggestions: ExtractedSuggestion[];
  conversationInsights: ConversationInsights;
  error?: string;
}

// API Request/Response types
export interface CreateTailoredResumeRequest {
  userId: string;
  jobAnalysisId: string;
  masterResumeId: string;
  tailoringLevel: TailoringLevel;
  versionName?: string;
}

export interface CreateTailoredResumeResponse {
  success: boolean;
  tailoredResume?: TailoredResume;
  recommendConversation?: boolean; // 🆕 Should user chat first?
  conversationTopics?: string[]; // 🆕 What to discuss
  message?: string; // 🆕 Guidance message
  error?: string;
}

export interface UpdateChangeStatusRequest {
  changeId: string;
  status: 'accepted' | 'rejected';
}

export interface UpdateChangeStatusResponse {
  success: boolean;
  change?: ResumeChange;
  updatedCounts?: {
    accepted: number;
    rejected: number;
    pending: number;
  };
  error?: string;
}

export interface GenerateDocxRequest {
  tailoredResumeId: string;
  includeRejectedChanges?: boolean; // Default false - only apply accepted changes
}

export interface GenerateDocxResponse {
  success: boolean;
  filePath?: string;
  downloadUrl?: string;
  error?: string;
}

// Tailoring level descriptions for UI
export const TAILORING_LEVELS: Record<TailoringLevel, {
  name: string;
  description: string;
  lexDescription: string;
  expectedChanges: string;
}> = {
  light: {
    name: 'Light Touch',
    description: 'Keyword optimization and minor phrasing adjustments',
    lexDescription: "I'll add relevant keywords naturally and tweak some phrases. Your resume stays mostly the same - just optimized for ATS.",
    expectedChanges: '5-10 small changes'
  },
  medium: {
    name: 'Balanced',
    description: 'Rewrite bullets to emphasize relevant experience, stronger action verbs',
    lexDescription: "I'll rewrite your bullet points to better highlight experience that matches this role. More impactful language, clearer achievements.",
    expectedChanges: '10-20 meaningful changes'
  },
  heavy: {
    name: 'Full Restructure',
    description: 'Significant rewrites, reordered sections, comprehensive optimization',
    lexDescription: "I'm going to reshape your resume around what this employer wants. Expect major rewrites and possibly reordering your experience.",
    expectedChanges: '20+ substantial changes'
  }
};

// 🆕 Honesty flag colors for UI
export const HONESTY_FLAG_CONFIG: Record<HonestyFlag, {
  color: string;
  bgColor: string;
  label: string;
  description: string;
}> = {
  SAFE: {
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-400/20',
    label: 'Safe',
    description: 'Accurate reframing of real experience'
  },
  QUESTIONABLE: {
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-400/20',
    label: 'Needs Discussion',
    description: 'Requires conversation to verify accuracy'
  },
  DISHONEST: {
    color: 'text-red-400',
    bgColor: 'bg-red-400/20',
    label: 'Dishonest',
    description: 'This change is not truthful - rejected'
  },
  PENDING: {
    color: 'text-white/40',
    bgColor: 'bg-white/10',
    label: 'Pending Review',
    description: 'Awaiting honesty check from Lex'
  }
};

// Helper to transform DB record to frontend format
export function transformTailoredResumeFromDB(db: TailoredResumeDB): TailoredResume {
  return {
    id: db.id,
    userId: db.user_id,
    jobAnalysisId: db.job_analysis_id,
    masterResumeId: db.master_resume_id,
    versionNumber: db.version_number,
    versionName: db.version_name,
    tailoringLevel: db.tailoring_level,
    originalContent: db.original_content,
    tailoredContent: db.tailored_content,
    changes: db.changes,
    changesAccepted: db.changes_accepted,
    changesRejected: db.changes_rejected,
    changesPending: db.changes_pending,
    lexCommentary: db.lex_commentary,
    lexOverallAssessment: db.lex_overall_assessment,
    gaps: db.gaps, // 🆕
    isFinalized: db.is_finalized,
    finalizedAt: db.finalized_at,
    filePath: db.file_path,
    fileGeneratedAt: db.file_generated_at,
    createdAt: db.created_at,
    updatedAt: db.updated_at
  };
}

// Helper to transform frontend format to DB record
export function transformTailoredResumeToDB(resume: Partial<TailoredResume>): Partial<TailoredResumeDB> {
  const db: Partial<TailoredResumeDB> = {};
  
  if (resume.id) db.id = resume.id;
  if (resume.userId) db.user_id = resume.userId;
  if (resume.jobAnalysisId) db.job_analysis_id = resume.jobAnalysisId;
  if (resume.masterResumeId) db.master_resume_id = resume.masterResumeId;
  if (resume.versionNumber) db.version_number = resume.versionNumber;
  if (resume.versionName) db.version_name = resume.versionName;
  if (resume.tailoringLevel) db.tailoring_level = resume.tailoringLevel;
  if (resume.originalContent) db.original_content = resume.originalContent;
  if (resume.tailoredContent) db.tailored_content = resume.tailoredContent;
  if (resume.changes) db.changes = resume.changes;
  if (resume.changesAccepted !== undefined) db.changes_accepted = resume.changesAccepted;
  if (resume.changesRejected !== undefined) db.changes_rejected = resume.changesRejected;
  if (resume.changesPending !== undefined) db.changes_pending = resume.changesPending;
  if (resume.lexCommentary) db.lex_commentary = resume.lexCommentary;
  if (resume.lexOverallAssessment) db.lex_overall_assessment = resume.lexOverallAssessment;
  if (resume.gaps) db.gaps = resume.gaps; // 🆕
  if (resume.isFinalized !== undefined) db.is_finalized = resume.isFinalized;
  if (resume.finalizedAt) db.finalized_at = resume.finalizedAt;
  if (resume.filePath) db.file_path = resume.filePath;
  if (resume.fileGeneratedAt) db.file_generated_at = resume.fileGeneratedAt;
  
  return db;
}