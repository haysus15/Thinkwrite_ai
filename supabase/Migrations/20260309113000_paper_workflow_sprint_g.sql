-- Sprint G: Paper workflow hardening + outline redesign groundwork

-- academic_papers: server-side step persistence
ALTER TABLE public.academic_papers
ADD COLUMN IF NOT EXISTS workflow_step text DEFAULT 'outline';

ALTER TABLE public.academic_papers
DROP CONSTRAINT IF EXISTS academic_papers_workflow_step_check;
ALTER TABLE public.academic_papers
ADD CONSTRAINT academic_papers_workflow_step_check
CHECK (workflow_step IN ('outline', 'generate', 'checkpoint', 'library'));

ALTER TABLE public.academic_papers
ADD COLUMN IF NOT EXISTS workflow_step_updated_at timestamptz DEFAULT now();

-- academic_outlines: student declaration
ALTER TABLE public.academic_outlines
ADD COLUMN IF NOT EXISTS student_declaration jsonb DEFAULT NULL;

-- academic_outlines: section confidence ratings
ALTER TABLE public.academic_outlines
ADD COLUMN IF NOT EXISTS section_confidence jsonb DEFAULT NULL;

-- academic_outlines: source requirements
ALTER TABLE public.academic_outlines
ADD COLUMN IF NOT EXISTS source_requirements jsonb DEFAULT NULL;
