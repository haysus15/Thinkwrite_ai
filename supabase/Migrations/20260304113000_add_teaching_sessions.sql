-- Migration: add_teaching_sessions
-- Shared teaching engine session state for Academic Studio.

CREATE TABLE IF NOT EXISTS public.teaching_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  problem_statement text NOT NULL,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  current_step_index integer NOT NULL DEFAULT 0,
  understanding_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.teaching_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own teaching sessions" ON public.teaching_sessions;
DROP POLICY IF EXISTS "Users can insert own teaching sessions" ON public.teaching_sessions;
DROP POLICY IF EXISTS "Users can update own teaching sessions" ON public.teaching_sessions;

CREATE POLICY "Users can read own teaching sessions"
  ON public.teaching_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own teaching sessions"
  ON public.teaching_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own teaching sessions"
  ON public.teaching_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS teaching_sessions_user_created_idx
  ON public.teaching_sessions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS teaching_sessions_subject_idx
  ON public.teaching_sessions(subject);

