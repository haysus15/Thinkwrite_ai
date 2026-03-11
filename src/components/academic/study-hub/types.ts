import type { QuizQuestionType } from "@/types/academic-studio";

export interface MaterialItem {
  id: string;
  title: string;
  class_name: string | null;
  topic: string | null;
  source_type: string | null;
  material_kind?: string | null;
  source_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface MaterialDetail extends MaterialItem {
  content: string;
  file_type: string | null;
  created_at: string;
}

export interface QuizItem {
  id: string;
  title: string;
  study_material_id: string | null;
  difficulty?: number | null;
  questions?: Array<{ type?: QuizQuestionType }>;
  created_at: string;
}

export interface AttemptItem {
  id: string;
  quiz_id: string;
  score: number | null;
  correct_count: number | null;
  total_questions: number | null;
  completed_at: string | null;
}
