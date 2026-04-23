// src/types/academic-studio.ts

export type VictorMode =
  | "default"
  | "idea_expansion"
  | "challenge"
  | "study"
  | "math"
  | "coding_review"
  | "teaching";

export type Subject =
  | "math"
  | "science"
  | "writing"
  | "history"
  | "computer-science"
  | "general";

export type AttemptResult =
  | "correct"
  | "partial"
  | "misconception"
  | "unattempted";

export interface ScaffoldedStep {
  stepNumber: number;
  title: string;
  instruction: string;
  gap: string | null;
  revealed: boolean;
  studentAttempt: string | null;
  attemptResult: AttemptResult | null;
  victorFeedback: string | null;
  subSteps: ScaffoldedStep[];
}

export interface UnderstandingProfile {
  strongConcepts: string[];
  gapConcepts: string[];
  misconceptions: string[];
  retriedSteps: number[];
}

export interface TeachingSession {
  sessionId: string;
  subject: Subject;
  problemStatement: string;
  steps: ScaffoldedStep[];
  currentStepIndex: number;
  completedAt: string | null;
  understandingProfile: UnderstandingProfile;
  plannedStepCount?: number;
}

export interface VictorSessionSummary {
  id: string;
  title: string;
  mode: VictorMode;
  lastMessageAt: string;
}

export interface AssignmentSummary {
  id: string;
  title: string;
  className: string;
  dueDate: string;
  status: "upcoming" | "overdue" | "in_progress";
}

export interface AcademicOutline {
  id: string;
  userId: string;
  topic: string;
  assignmentType: string;
  className: string;
  thesis: string;
  sections: Array<{
    title: string;
    mainPoints: string[];
    evidence: string[];
  }>;
  conclusion: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaperRequirements {
  wordCount: number;
  citationStyle: string;
  minSources: number;
  requiredSections: string[];
}

export interface AcademicPaper {
  id: string;
  userId: string;
  outlineId: string;
  topic: string;
  content: string;
  citationStyle: string;
  wordCount: number;
  checkpointPassed: boolean;
  emergencySkipUsed: boolean;
  createdAt: string;
  completedAt?: string;
}

export type QuizQuestionType =
  | "multiple_choice"
  | "true_false"
  | "short_answer"
  | "essay";

export interface QuizQuestion {
  id: string;
  type: QuizQuestionType;
  text: string;
  options?: string[];
  correct_answer?: string | boolean;
  explanation?: string;
}

export interface QuizConfig {
  questionCount: number;
  questionTypes: QuizQuestionType[];
  difficulty: number;
}

export interface QuizResultItem {
  questionId: string;
  type: QuizQuestionType;
  correct: boolean | null;
  points: number | null;
  feedback?: string;
  correctAnswer?: string | boolean;
}

export interface AssignmentRequirements {
  page_count?: number;
  word_count?: number;
  min_sources?: number;
  citation_style?: "APA" | "MLA" | "Chicago" | "IEEE";
  required_sections?: string[];
  format?: string;
  other?: string;
  instructions?: string;
  guidelines?: string;
}

export interface AssignmentRow {
  id: string;
  syllabus_id?: string | null;
  assignment_name: string;
  class_name: string;
  due_date: string | null;
  agenda_date?: string | null;
  assignment_type: string | null;
  requirements: AssignmentRequirements | null;
  notes?: string | null;
  completed: boolean;
  archived_at?: string | null;
  updated_at?: string | null;
  status?:
    | "inbox"
    | "planned"
    | "in_progress"
    | "ready_to_submit"
    | "submitted"
    | "completed";
  priority?: "low" | "medium" | "high" | "critical" | null;
  grading_weight?: number | null;
  progress_percent?: number;
  is_at_risk?: boolean;
  days_until_due?: number;
  assignment_tasks?: Array<{
    id: string;
    task_type: "research" | "outline" | "draft" | "revise" | "submit" | "other";
    label: string | null;
    status: "pending" | "in_progress" | "complete";
    planned_date: string | null;
    completed_at: string | null;
    sort_order: number;
  }>;
  tasks?: Array<{
    id: string;
    task_type: "research" | "outline" | "draft" | "revise" | "submit" | "other";
    label: string | null;
    status: "pending" | "in_progress" | "complete";
    planned_date: string | null;
    completed_at: string | null;
    sort_order: number;
  }>;
}
