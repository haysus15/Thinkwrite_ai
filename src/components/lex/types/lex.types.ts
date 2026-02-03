// src/components/lex/types/lex.types.ts

export interface Message {
  id: string;
  text: string;
  sender: "user" | "lex";
  timestamp: Date;
  documentId?: string;
  jobContext?: {
    jobId: string;
    jobTitle: string;
    company: string;
  };
  matchContext?: {
    matchScore: number;
    gaps: string[];
    strengths: string[];
  };
  tailoredResumeContext?: {
    tailoredResumeId: string;
    jobTitle: string;
    company: string;
    changesCount: number;
  };
}

export interface SavedConversation {
  id: string;
  title: string;
  description?: string;
  messageCount: number;
  lastMessageAt: string;
  topic: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ResumeContext {
  hasResume: boolean;
  masterResume?: {
    id: string;
    fileName: string;
    score?: number;
    analysisStatus: "pending" | "complete" | "needs_lex_review";
  };
  allResumes?: Array<{
    id: string;
    fileName: string;
    score?: number;
  }>;
}

export interface JobContext {
  id: string;
  jobTitle: string;
  company: string;
  location: string;
  hiddenInsights: any;
  industryIntelligence: any;
  atsKeywords: any;
}

export interface MatchContext {
  matchScore: number;
  gaps: string[];
  strengths: string[];
  recommendation: string;
  jobTitle: string;
  company: string;
  resumeName: string;
}

export interface TailoredResumeContext {
  id: string;
  jobTitle: string;
  company: string;
  tailoringLevel: "light" | "medium" | "heavy";
  changes: Array<{
    id: string;
    section: string;
    original: string;
    tailored: string;
    reason: string;
    impact: string;
    status: "pending" | "accepted" | "rejected";
    lexTip: string;
    keywords?: string[];
  }>;
  changesAccepted: number;
  changesRejected: number;
  changesPending: number;
  lexCommentary: {
    overallAssessment: string;
    tailoringStrategy: string;
    keyImprovements: string[];
    honestFeedback: string;
    interviewTips: string[];
  };
  isFinalized: boolean;
}

export type SessionType = 
  | "general"
  | "resume-tailoring"
  | "cover-letter"
  | "job-discussion"
  | "match-analysis"
  | "career-assessment";

export interface QuickAction {
  text: string;
  action: string;
}