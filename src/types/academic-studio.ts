// src/types/academic-studio.ts

export type VictorMode =
  | "default"
  | "idea_expansion"
  | "challenge"
  | "study"
  | "math";

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
}

export interface AssignmentRow {
  id: string;
  assignment_name: string;
  class_name: string;
  due_date: string | null;
  assignment_type: string | null;
  requirements: AssignmentRequirements | null;
  completed: boolean;
}
