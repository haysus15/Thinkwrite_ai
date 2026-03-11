-- Sprint: Paper Workflow Assignment Layer

CREATE TABLE IF NOT EXISTS public.paper_assignment_sets (
  id UUID NOT NULL DEFAULT extensions.uuid_generate_v4(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  class_name TEXT NULL,
  assignment_prompt TEXT NULL,
  rubric_text TEXT NULL,
  paper_count INTEGER NULL,
  source_type TEXT NOT NULL DEFAULT 'manual',
  source_raw TEXT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress',
  completed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT paper_assignment_sets_pkey PRIMARY KEY (id),
  CONSTRAINT paper_assignment_sets_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT paper_assignment_sets_source_type_check CHECK (
    source_type IN ('manual', 'paste', 'upload')
  ),
  CONSTRAINT paper_assignment_sets_status_check CHECK (
    status IN ('in_progress', 'completed', 'abandoned')
  )
);

CREATE INDEX IF NOT EXISTS idx_paper_assignment_sets_user
  ON public.paper_assignment_sets (user_id, created_at DESC);

ALTER TABLE public.paper_assignment_sets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS paper_assignment_sets_user_policy ON public.paper_assignment_sets;
CREATE POLICY paper_assignment_sets_user_policy ON public.paper_assignment_sets
  FOR ALL USING (user_id = auth.uid());

ALTER TABLE public.academic_papers
  ADD COLUMN IF NOT EXISTS assignment_set_id UUID NULL,
  ADD COLUMN IF NOT EXISTS set_order INTEGER NULL;

ALTER TABLE public.academic_papers
  DROP CONSTRAINT IF EXISTS papers_assignment_set_id_fkey;

ALTER TABLE public.academic_papers
  ADD CONSTRAINT papers_assignment_set_id_fkey
  FOREIGN KEY (assignment_set_id)
  REFERENCES public.paper_assignment_sets (id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_academic_papers_assignment_set
  ON public.academic_papers (assignment_set_id, set_order ASC);

ALTER TABLE public.academic_papers
  ADD COLUMN IF NOT EXISTS is_complete BOOLEAN NOT NULL DEFAULT false;
