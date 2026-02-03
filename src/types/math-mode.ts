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

export type StepStatus = "unchecked" | "correct" | "error" | "partial";
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
