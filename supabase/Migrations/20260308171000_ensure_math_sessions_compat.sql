-- Ensure Victor math-mode legacy session table exists in fresh environments.
-- This is compatibility-only and does not replace math_work_sessions.

CREATE TABLE IF NOT EXISTS public.math_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.victor_conversations(id) ON DELETE CASCADE,
  problem_text text NOT NULL,
  student_work jsonb NOT NULL DEFAULT '[]'::jsonb,
  verification_results jsonb,
  problem_type text,
  concepts_used jsonb,
  final_answer_correct boolean NOT NULL DEFAULT false,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS math_sessions_user_conversation_idx
  ON public.math_sessions(user_id, conversation_id, completed, created_at DESC);

ALTER TABLE public.math_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "math_sessions_all_own" ON public.math_sessions;
CREATE POLICY "math_sessions_all_own"
  ON public.math_sessions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
