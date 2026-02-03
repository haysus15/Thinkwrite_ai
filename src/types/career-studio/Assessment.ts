// Assessment Types for Career Studio
// src/types/career-studio/Assessment.ts
// Re-exports from the main career-assessment.ts for consistency

export type {
  AssessmentStatus,
  QuestionType,
  AssessmentPhase,
  AssessmentQuestion,
  AssessmentAnswers,
  GapAnalysisItem,
  ActionItem,
  JobTarget,
  CareerRoadmap,
  CareerAssessment,
  CareerAssessmentDB,
} from '../career-assessment';

export {
  ASSESSMENT_QUESTIONS,
  getQuestionsByPhase,
  getPhaseProgress,
  generateAssessmentId,
} from '../career-assessment';

// Additional assessment-related types specific to Career Studio

export interface AssessmentSummary {
  id: string;
  status: 'in_progress' | 'completed' | 'abandoned';
  phase: string;
  progress: number;
  startedAt: string;
  completedAt?: string;
  hasRoadmap: boolean;
}

export interface AssessmentProgress {
  currentPhase: number;
  totalPhases: number;
  currentQuestion: number;
  totalQuestions: number;
  percentComplete: number;
  estimatedTimeRemaining: number; // in minutes
}

export interface AssessmentRecommendation {
  type: 'skill' | 'certification' | 'education' | 'experience' | 'networking';
  title: string;
  description: string;
  priority: 'critical' | 'recommended' | 'optional';
  timeframe: 'immediate' | 'short_term' | 'long_term';
  resources?: {
    name: string;
    url: string;
    cost?: string;
  }[];
}

export interface SkillGapAnalysis {
  category: string;
  currentLevel: 'none' | 'beginner' | 'intermediate' | 'advanced' | 'expert';
  targetLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  gapSeverity: 'critical' | 'moderate' | 'minor';
  recommendations: string[];
}

// Assessment API types
export interface StartAssessmentRequest {
  userId: string;
  resumeId?: string;
}

export interface StartAssessmentResponse {
  success: boolean;
  assessmentId?: string;
  firstQuestion?: any;
  error?: string;
}

export interface SubmitAnswerRequest {
  assessmentId: string;
  questionId: string;
  answer: string | string[] | number;
}

export interface SubmitAnswerResponse {
  success: boolean;
  nextQuestion?: any;
  isComplete?: boolean;
  progress?: AssessmentProgress;
  error?: string;
}

export interface GenerateRoadmapRequest {
  assessmentId: string;
}

export interface GenerateRoadmapResponse {
  success: boolean;
  roadmap?: any;
  estimatedGenerationTime?: number;
  error?: string;
}
