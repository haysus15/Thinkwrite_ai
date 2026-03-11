-- Index for downstream invalidation and ordered verification passes.
CREATE INDEX IF NOT EXISTS idx_math_steps_problem_step_number
  ON public.math_steps (problem_id, step_number ASC);
