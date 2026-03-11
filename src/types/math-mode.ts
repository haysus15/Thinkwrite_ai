export type MathProblemType =
  | "derivative"
  | "integral"
  | "algebra"
  | "geometry"
  | "trigonometry"
  | "statistics"
  | "linear_algebra"
  | "calculus"
  | "arithmetic"
  | "other";

export type StepStatus =
  | "unchecked"
  | "correct"
  | "equivalent_form"
  | "likely_correct"
  | "incorrect"
  | "needs_recheck"
  | "error"
  | "partial";
export type ErrorType = "arithmetic" | "conceptual" | "procedural" | "notation";
export type GuidanceType =
  | "question"
  | "hint"
  | "correction"
  | "encouragement"
  | "concept";

export interface MathProblem {
  id: string;
  user_id: string;
  problem_set_id?: string | null;
  set_order?: number | null;
  latex: string;
  plain_text?: string;
  problem_type?: MathProblemType;
  graph_expression?: string;
  graph_visible: boolean;
  completed: boolean;
  final_answer_correct?: boolean;
  created_at: string;
  completed_at?: string;
}

export interface MathProblemSet {
  id: string;
  user_id: string;
  title: string;
  class_name?: string | null;
  assignment_prompt?: string | null;
  problem_count?: number | null;
  source_type: "manual" | "paste" | "upload";
  source_raw?: string | null;
  status: "in_progress" | "completed" | "abandoned";
  completed_at?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface MathStep {
  id: string;
  problem_id: string;
  user_id: string;
  step_number: number;
  latex: string;
  plain_text?: string;
  reasoning?: string;
  status: StepStatus;
  error_type?: ErrorType;
  feedback?: string;
  created_at: string;
  verified_at?: string;
  is_final_answer?: boolean;
}

export interface MathGuidance {
  id: string;
  problem_id: string;
  message: string;
  guidance_type: GuidanceType;
  related_step_id?: string;
  created_at: string;
}

export interface MathVerificationResult {
  step_id: string;
  is_correct: boolean;
  status: StepStatus;
  error_type?: ErrorType;
  transformation_applied?: string;
  error_location?: string | null;
  correction_hint?: string | null;
  feedback: string;
  victor_guidance?: string;
}

export interface MathPractice {
  id: string;
  latex: string;
  plain_text?: string;
  problem_type?: MathProblemType;
  difficulty: "easier" | "same" | "harder";
  attempted: boolean;
  completed: boolean;
}

export type MathSessionLifecycleState =
  | "idle"
  | "active"
  | "completing"
  | "completed";

export interface MathSessionSummaryConcept {
  tag: string;
  display_name: string;
  mastery_level: number;
}

export interface MathSessionSummary {
  steps_total: number;
  steps_correct_first_try: number;
  steps_revised: number;
  hints_used: number;
  completion_time_seconds: number;
  concepts: MathSessionSummaryConcept[];
  natural_summary: string;
}
