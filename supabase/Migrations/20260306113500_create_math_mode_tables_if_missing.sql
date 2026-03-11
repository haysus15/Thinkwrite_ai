-- Math Mode core tables (safe bootstrap for fresh environments).
CREATE TABLE IF NOT EXISTS public.math_problems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  latex text NOT NULL,
  plain_text text,
  problem_type text,
  graph_expression text,
  graph_visible boolean NOT NULL DEFAULT true,
  completed boolean NOT NULL DEFAULT false,
  final_answer_correct boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.math_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id uuid NOT NULL REFERENCES public.math_problems(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  step_number integer NOT NULL,
  latex text NOT NULL DEFAULT '',
  plain_text text,
  reasoning text,
  status text NOT NULL DEFAULT 'unchecked',
  error_type text,
  feedback text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz,
  invalidated_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.math_guidance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id uuid NOT NULL REFERENCES public.math_problems(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL,
  guidance_type text NOT NULL DEFAULT 'hint',
  related_step_id uuid REFERENCES public.math_steps(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.math_work_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  problem_id uuid NOT NULL REFERENCES public.math_problems(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'in_progress',
  total_steps integer NOT NULL DEFAULT 0,
  correct_steps integer NOT NULL DEFAULT 0,
  hints_used integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.math_practice (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  latex text NOT NULL,
  plain_text text,
  problem_type text,
  difficulty text NOT NULL DEFAULT 'same',
  attempted boolean NOT NULL DEFAULT false,
  completed boolean NOT NULL DEFAULT false,
  solution_steps jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.math_concept_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  concept text NOT NULL,
  times_encountered integer NOT NULL DEFAULT 0,
  times_correct integer NOT NULL DEFAULT 0,
  times_error integer NOT NULL DEFAULT 0,
  mastery_level integer NOT NULL DEFAULT 0,
  last_encountered timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, concept)
);

CREATE INDEX IF NOT EXISTS idx_math_problems_user_created
  ON public.math_problems(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_math_steps_problem
  ON public.math_steps(problem_id, step_number ASC);
CREATE INDEX IF NOT EXISTS idx_math_guidance_problem
  ON public.math_guidance(problem_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_math_work_sessions_problem
  ON public.math_work_sessions(problem_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_math_concept_progress_user
  ON public.math_concept_progress(user_id, concept);
