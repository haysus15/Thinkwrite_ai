-- Activate RLS and user policy on math_concept_progress.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'math_concept_progress'
  ) THEN
    ALTER TABLE public.math_concept_progress ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS math_concept_progress_user_policy ON public.math_concept_progress;
    CREATE POLICY math_concept_progress_user_policy ON public.math_concept_progress
      FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END
$$;
