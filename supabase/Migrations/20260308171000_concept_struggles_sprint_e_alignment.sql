-- Sprint E alignment for Victor teaching memory schema.
-- Keeps legacy concept_struggles columns for backward compatibility.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'concept_struggles'
  ) THEN
    CREATE TABLE public.concept_struggles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      assignment_id uuid REFERENCES public.assignments(id) ON DELETE SET NULL,
      class_name text NOT NULL,
      concept text NOT NULL,
      struggle_type text NOT NULL,
      detected_at timestamptz DEFAULT now(),
      resolved boolean DEFAULT false,
      resolved_at timestamptz,
      session_notes text,
      created_at timestamptz DEFAULT now()
    );
  END IF;
END $$;

ALTER TABLE public.concept_struggles
  ADD COLUMN IF NOT EXISTS assignment_id uuid REFERENCES public.assignments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS class_name text,
  ADD COLUMN IF NOT EXISTS concept text,
  ADD COLUMN IF NOT EXISTS struggle_type text,
  ADD COLUMN IF NOT EXISTS detected_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS session_notes text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

DO $$
DECLARE
  has_recorded_at boolean;
  has_concept_tag boolean;
  has_subject boolean;
  has_workspace_context boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'concept_struggles' AND column_name = 'recorded_at'
  ) INTO has_recorded_at;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'concept_struggles' AND column_name = 'concept_tag'
  ) INTO has_concept_tag;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'concept_struggles' AND column_name = 'subject'
  ) INTO has_subject;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'concept_struggles' AND column_name = 'workspace_context'
  ) INTO has_workspace_context;

  IF has_concept_tag THEN
    UPDATE public.concept_struggles
    SET concept = COALESCE(concept, concept_tag)
    WHERE concept IS NULL;
  END IF;

  IF has_recorded_at THEN
    UPDATE public.concept_struggles
    SET detected_at = COALESCE(detected_at, recorded_at)
    WHERE detected_at IS NULL;

    UPDATE public.concept_struggles
    SET created_at = COALESCE(created_at, recorded_at)
    WHERE created_at IS NULL;
  END IF;

  IF has_workspace_context THEN
    UPDATE public.concept_struggles
    SET class_name = COALESCE(class_name, workspace_context)
    WHERE class_name IS NULL;
  END IF;

  IF has_subject THEN
    UPDATE public.concept_struggles
    SET struggle_type = COALESCE(
      struggle_type,
      CASE
        WHEN subject = 'math' THEN 'reasoning_gap'
        WHEN subject = 'writing' THEN 'incomplete_understanding'
        ELSE 'misconception'
      END
    )
    WHERE struggle_type IS NULL;
  END IF;
END $$;

UPDATE public.concept_struggles
SET class_name = 'General class'
WHERE class_name IS NULL OR btrim(class_name) = '';

UPDATE public.concept_struggles
SET concept = 'core concept'
WHERE concept IS NULL OR btrim(concept) = '';

UPDATE public.concept_struggles
SET struggle_type = 'misconception'
WHERE struggle_type IS NULL OR btrim(struggle_type) = '';

ALTER TABLE public.concept_struggles
  ALTER COLUMN class_name SET NOT NULL,
  ALTER COLUMN concept SET NOT NULL,
  ALTER COLUMN struggle_type SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN detected_at SET DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'concept_struggles_struggle_type_check'
      AND conrelid = 'public.concept_struggles'::regclass
  ) THEN
    ALTER TABLE public.concept_struggles
      ADD CONSTRAINT concept_struggles_struggle_type_check
      CHECK (
        struggle_type IN ('misconception', 'recall_gap', 'reasoning_gap', 'incomplete_understanding')
      );
  END IF;
END $$;

ALTER TABLE public.concept_struggles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS concept_struggles_owner_select ON public.concept_struggles;
DROP POLICY IF EXISTS concept_struggles_owner_insert ON public.concept_struggles;
DROP POLICY IF EXISTS concept_struggles_owner_update ON public.concept_struggles;
DROP POLICY IF EXISTS concept_struggles_owner_delete ON public.concept_struggles;

CREATE POLICY concept_struggles_owner_select
  ON public.concept_struggles
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY concept_struggles_owner_insert
  ON public.concept_struggles
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY concept_struggles_owner_update
  ON public.concept_struggles
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY concept_struggles_owner_delete
  ON public.concept_struggles
  FOR DELETE
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS concept_struggles_user_class_idx
  ON public.concept_struggles (user_id, class_name);

CREATE INDEX IF NOT EXISTS concept_struggles_assignment_idx
  ON public.concept_struggles (assignment_id)
  WHERE assignment_id IS NOT NULL;
