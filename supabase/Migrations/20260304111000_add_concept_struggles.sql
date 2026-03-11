-- Migration: add_concept_struggles
-- Logs concept-level struggle telemetry for Academic Studio teaching engine.

CREATE TABLE IF NOT EXISTS public.concept_struggles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid,
  concept_tag text NOT NULL,
  workspace_context text NOT NULL,
  subject text NOT NULL,
  attempt_count integer NOT NULL DEFAULT 1,
  victor_intervened boolean NOT NULL DEFAULT false,
  intervention_reason text,
  resolved boolean NOT NULL DEFAULT false,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.concept_struggles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own struggles" ON public.concept_struggles;
DROP POLICY IF EXISTS "Users can insert own struggles" ON public.concept_struggles;

CREATE POLICY "Users can read own struggles"
  ON public.concept_struggles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own struggles"
  ON public.concept_struggles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS concept_struggles_user_concept_idx
  ON public.concept_struggles(user_id, concept_tag);

CREATE INDEX IF NOT EXISTS concept_struggles_user_workspace_idx
  ON public.concept_struggles(user_id, workspace_context);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'teaching_sessions'
  ) THEN
    ALTER TABLE public.concept_struggles
      DROP CONSTRAINT IF EXISTS concept_struggles_session_id_fkey;

    ALTER TABLE public.concept_struggles
      ADD CONSTRAINT concept_struggles_session_id_fkey
      FOREIGN KEY (session_id)
      REFERENCES public.teaching_sessions(id)
      ON DELETE SET NULL;
  END IF;
END $$;
