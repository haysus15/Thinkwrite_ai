-- Migration: academic_studio_canonical_schema
-- Canonical Academic Studio schema derived from active code paths.
-- Safe for partially-provisioned environments.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS coding_review;

-- =========================
-- Core Victor / Academic
-- =========================

CREATE TABLE IF NOT EXISTS public.victor_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'default',
  title text,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  saved boolean NOT NULL DEFAULT false,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.victor_conversations
  DROP CONSTRAINT IF EXISTS victor_conversations_mode_check;
ALTER TABLE public.victor_conversations
  ADD CONSTRAINT victor_conversations_mode_check
  CHECK (mode = ANY (ARRAY[
    'default',
    'idea_expansion',
    'challenge',
    'study',
    'math',
    'coding_review'
  ]));

CREATE INDEX IF NOT EXISTS victor_conversations_user_idx
  ON public.victor_conversations(user_id, last_message_at DESC);

CREATE TABLE IF NOT EXISTS public.mode_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.victor_conversations(id) ON DELETE CASCADE,
  from_mode text NOT NULL,
  to_mode text NOT NULL,
  trigger text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mode_transitions_conversation_idx
  ON public.mode_transitions(conversation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.challenge_intensity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  intensity_level integer NOT NULL DEFAULT 3,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, subject)
);

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

CREATE TABLE IF NOT EXISTS public.academic_outlines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic text NOT NULL,
  assignment_type text,
  class_name text,
  outline_structure jsonb NOT NULL,
  conversation_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS academic_outlines_user_updated_idx
  ON public.academic_outlines(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.emergency_skips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paper_id uuid,
  month text NOT NULL,
  skipped_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS emergency_skips_user_month_idx
  ON public.emergency_skips(user_id, month);

CREATE TABLE IF NOT EXISTS public.syllabi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_name text NOT NULL,
  file_url text,
  file_type text,
  parsed_data jsonb,
  confirmed boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'draft',
  parse_confidence numeric,
  parser_version text,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.syllabi
  DROP CONSTRAINT IF EXISTS syllabi_status_check;
ALTER TABLE public.syllabi
  ADD CONSTRAINT syllabi_status_check
  CHECK (status = ANY (ARRAY['draft', 'approved', 'archived']));

CREATE INDEX IF NOT EXISTS syllabi_user_uploaded_idx
  ON public.syllabi(user_id, uploaded_at DESC);

CREATE TABLE IF NOT EXISTS public.assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  syllabus_id uuid REFERENCES public.syllabi(id) ON DELETE SET NULL,
  class_name text NOT NULL,
  assignment_name text NOT NULL,
  assignment_type text NOT NULL,
  due_date date,
  requirements jsonb,
  grading_weight numeric,
  notes text,
  completed boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  archived_reason text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.assignments
  DROP CONSTRAINT IF EXISTS assignments_assignment_type_check;
ALTER TABLE public.assignments
  ADD CONSTRAINT assignments_assignment_type_check
  CHECK (assignment_type = ANY (ARRAY[
    'test',
    'quiz',
    'paper',
    'homework',
    'lab',
    'project',
    'reading',
    'discussion',
    'milestone',
    'presentation',
    'exam',
    'assignment',
    'other'
  ]));

CREATE INDEX IF NOT EXISTS assignments_user_due_idx
  ON public.assignments(user_id, due_date);
CREATE INDEX IF NOT EXISTS assignments_user_status_idx
  ON public.assignments(user_id, archived_at, completed);
CREATE INDEX IF NOT EXISTS assignments_syllabus_idx
  ON public.assignments(syllabus_id);

CREATE TABLE IF NOT EXISTS public.assignment_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  field_changed text NOT NULL,
  old_value text,
  new_value text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS assignment_overrides_assignment_idx
  ON public.assignment_overrides(assignment_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.syllabus_assignment_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  syllabus_id uuid NOT NULL REFERENCES public.syllabi(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_name text NOT NULL,
  assignment_name text NOT NULL,
  assignment_type text,
  due_date date,
  requirements jsonb,
  grading_weight numeric,
  parser_confidence numeric,
  parser_notes text,
  draft_status text NOT NULL DEFAULT 'parsed',
  position integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.syllabus_assignment_drafts
  DROP CONSTRAINT IF EXISTS syllabus_assignment_drafts_status_check;
ALTER TABLE public.syllabus_assignment_drafts
  ADD CONSTRAINT syllabus_assignment_drafts_status_check
  CHECK (draft_status = ANY (ARRAY['parsed', 'edited', 'approved', 'rejected', 'published']));

CREATE INDEX IF NOT EXISTS syllabus_assignment_drafts_syllabus_idx
  ON public.syllabus_assignment_drafts(syllabus_id, position);
CREATE INDEX IF NOT EXISTS syllabus_assignment_drafts_user_idx
  ON public.syllabus_assignment_drafts(user_id, syllabus_id);

CREATE TABLE IF NOT EXISTS public.syllabus_approval_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  syllabus_id uuid NOT NULL REFERENCES public.syllabi(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  approved_at timestamptz NOT NULL DEFAULT now(),
  assignments_created integer NOT NULL DEFAULT 0,
  assignments_archived integer NOT NULL DEFAULT 0,
  notes text,
  event_payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS syllabus_approval_events_syllabus_idx
  ON public.syllabus_approval_events(syllabus_id, approved_at DESC);

CREATE TABLE IF NOT EXISTS public.academic_papers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  outline_id uuid REFERENCES public.academic_outlines(id) ON DELETE SET NULL,
  assignment_id uuid REFERENCES public.assignments(id) ON DELETE SET NULL,
  topic text NOT NULL,
  paper_content text NOT NULL,
  citation_style text,
  citation_count integer,
  word_count integer,
  checkpoint_passed boolean NOT NULL DEFAULT false,
  emergency_skip_used boolean NOT NULL DEFAULT false,
  understanding_conversation jsonb,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS academic_papers_user_created_idx
  ON public.academic_papers(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.study_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  file_url text,
  file_type text,
  class_name text,
  topic text,
  source_type text NOT NULL,
  source_id text,
  origin_workspace text,
  origin_mode text,
  language text,
  path_id text,
  lesson_index integer,
  material_kind text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.study_materials
  DROP CONSTRAINT IF EXISTS study_materials_source_type_check;
ALTER TABLE public.study_materials
  ADD CONSTRAINT study_materials_source_type_check
  CHECK (source_type = ANY (ARRAY[
    'uploaded',
    'generated',
    'from_paper',
    'coding_review_guide',
    'learning_coach_guide',
    'quiz_source',
    'math_guide'
  ]));

ALTER TABLE public.study_materials
  DROP CONSTRAINT IF EXISTS study_materials_material_kind_check;
ALTER TABLE public.study_materials
  ADD CONSTRAINT study_materials_material_kind_check
  CHECK (material_kind IS NULL OR material_kind = ANY (ARRAY[
    'study_guide',
    'lesson_notes',
    'quiz_source',
    'reference',
    'uploaded_doc'
  ]));

ALTER TABLE public.study_materials
  DROP CONSTRAINT IF EXISTS study_materials_origin_workspace_check;
ALTER TABLE public.study_materials
  ADD CONSTRAINT study_materials_origin_workspace_check
  CHECK (origin_workspace IS NULL OR origin_workspace = ANY (ARRAY[
    'coding_review',
    'math',
    'study_library',
    'academic',
    'manual'
  ]));

CREATE INDEX IF NOT EXISTS study_materials_user_created_idx
  ON public.study_materials(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS study_materials_source_idx
  ON public.study_materials(source_type);

CREATE TABLE IF NOT EXISTS public.quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  study_material_id uuid REFERENCES public.study_materials(id) ON DELETE SET NULL,
  title text NOT NULL,
  questions jsonb NOT NULL,
  difficulty integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quizzes_user_created_idx
  ON public.quizzes(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  answers jsonb,
  results jsonb,
  score numeric,
  correct_count numeric,
  total_questions numeric,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quiz_attempts_user_completed_idx
  ON public.quiz_attempts(user_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS quiz_attempts_quiz_idx
  ON public.quiz_attempts(quiz_id, completed_at DESC);

-- =========================
-- Coding Review schema
-- =========================

CREATE TABLE IF NOT EXISTS coding_review.paths (
  id text PRIMARY KEY,
  language text NOT NULL,
  title text NOT NULL,
  description text,
  difficulty text,
  estimated_hours integer,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS coding_review.lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id text NOT NULL REFERENCES coding_review.paths(id) ON DELETE CASCADE,
  lesson_index integer NOT NULL,
  title text NOT NULL,
  concept_summary text,
  challenge_prompt text,
  required_skills jsonb,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(path_id, lesson_index)
);

CREATE TABLE IF NOT EXISTS coding_review.templates (
  id text PRIMARY KEY,
  language text NOT NULL,
  title text NOT NULL,
  description text,
  starter_code text,
  expected_output text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS coding_review.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  language text NOT NULL,
  entry_type text NOT NULL,
  path_id text REFERENCES coding_review.paths(id) ON DELETE SET NULL,
  assignment_id uuid REFERENCES public.assignments(id) ON DELETE SET NULL,
  code_snapshot text,
  output_snapshot text,
  victor_context jsonb,
  completed_at timestamptz,
  last_active_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coding_review_sessions_user_last_active_idx
  ON coding_review.sessions(user_id, last_active_at DESC);

CREATE TABLE IF NOT EXISTS coding_review.submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES coding_review.sessions(id) ON DELETE CASCADE,
  language text NOT NULL,
  code text NOT NULL,
  output text,
  error text,
  execution_time_ms integer,
  challenge_id text,
  is_checkpoint_attempt boolean NOT NULL DEFAULT false,
  checkpoint_passed boolean,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coding_review_submissions_session_idx
  ON coding_review.submissions(session_id, created_at DESC);

CREATE TABLE IF NOT EXISTS coding_review.placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  path_id text NOT NULL REFERENCES coding_review.paths(id) ON DELETE CASCADE,
  challenges_presented jsonb NOT NULL DEFAULT '[]'::jsonb,
  student_responses jsonb NOT NULL DEFAULT '[]'::jsonb,
  assessed_level integer,
  victor_reasoning text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, path_id)
);

CREATE TABLE IF NOT EXISTS coding_review.path_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  path_id text NOT NULL REFERENCES coding_review.paths(id) ON DELETE CASCADE,
  current_lesson integer NOT NULL DEFAULT 0,
  lessons_completed jsonb NOT NULL DEFAULT '[]'::jsonb,
  placement_level integer,
  placement_data jsonb,
  checkpoint_results jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_time_seconds integer NOT NULL DEFAULT 0,
  struggle_topics jsonb NOT NULL DEFAULT '[]'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_active_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, path_id)
);

CREATE TABLE IF NOT EXISTS coding_review.checkpoint_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES coding_review.sessions(id) ON DELETE CASCADE,
  submission_id uuid NOT NULL REFERENCES coding_review.submissions(id) ON DELETE CASCADE,
  path_id text REFERENCES coding_review.paths(id) ON DELETE SET NULL,
  lesson_index integer,
  pass boolean NOT NULL,
  feedback text,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coding_review_checkpoint_reviews_user_idx
  ON coding_review.checkpoint_reviews(user_id, reviewed_at DESC);

-- FK from study_materials -> coding_review.paths now that paths exists
ALTER TABLE public.study_materials
  DROP CONSTRAINT IF EXISTS study_materials_path_id_fkey;
ALTER TABLE public.study_materials
  ADD CONSTRAINT study_materials_path_id_fkey
  FOREIGN KEY (path_id) REFERENCES coding_review.paths(id) ON DELETE SET NULL;

-- =========================
-- RLS Policies
-- =========================

ALTER TABLE public.victor_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mode_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_intensity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.math_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_outlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_skips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.syllabi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.syllabus_assignment_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.syllabus_approval_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

ALTER TABLE coding_review.paths ENABLE ROW LEVEL SECURITY;
ALTER TABLE coding_review.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE coding_review.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE coding_review.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE coding_review.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE coding_review.placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE coding_review.path_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE coding_review.checkpoint_reviews ENABLE ROW LEVEL SECURITY;

-- User-owned table helper policies
DO $$
BEGIN
  -- victor_conversations
  EXECUTE 'DROP POLICY IF EXISTS "vc_select_own" ON public.victor_conversations';
  EXECUTE 'CREATE POLICY "vc_select_own" ON public.victor_conversations FOR SELECT USING (auth.uid() = user_id)';
  EXECUTE 'DROP POLICY IF EXISTS "vc_insert_own" ON public.victor_conversations';
  EXECUTE 'CREATE POLICY "vc_insert_own" ON public.victor_conversations FOR INSERT WITH CHECK (auth.uid() = user_id)';
  EXECUTE 'DROP POLICY IF EXISTS "vc_update_own" ON public.victor_conversations';
  EXECUTE 'CREATE POLICY "vc_update_own" ON public.victor_conversations FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
  EXECUTE 'DROP POLICY IF EXISTS "vc_delete_own" ON public.victor_conversations';
  EXECUTE 'CREATE POLICY "vc_delete_own" ON public.victor_conversations FOR DELETE USING (auth.uid() = user_id)';

  -- mode_transitions
  EXECUTE 'DROP POLICY IF EXISTS "mode_transitions_select_own" ON public.mode_transitions';
  EXECUTE 'CREATE POLICY "mode_transitions_select_own" ON public.mode_transitions FOR SELECT USING (EXISTS (SELECT 1 FROM public.victor_conversations vc WHERE vc.id = conversation_id AND vc.user_id = auth.uid()))';
  EXECUTE 'DROP POLICY IF EXISTS "mode_transitions_insert_own" ON public.mode_transitions';
  EXECUTE 'CREATE POLICY "mode_transitions_insert_own" ON public.mode_transitions FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.victor_conversations vc WHERE vc.id = conversation_id AND vc.user_id = auth.uid()))';

  -- simple user-owned public tables
  EXECUTE 'DROP POLICY IF EXISTS "challenge_intensity_select_own" ON public.challenge_intensity';
  EXECUTE 'CREATE POLICY "challenge_intensity_select_own" ON public.challenge_intensity FOR SELECT USING (auth.uid() = user_id)';
  EXECUTE 'DROP POLICY IF EXISTS "challenge_intensity_upsert_own" ON public.challenge_intensity';
  EXECUTE 'CREATE POLICY "challenge_intensity_upsert_own" ON public.challenge_intensity FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';

  EXECUTE 'DROP POLICY IF EXISTS "math_sessions_all_own" ON public.math_sessions';
  EXECUTE 'CREATE POLICY "math_sessions_all_own" ON public.math_sessions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';

  EXECUTE 'DROP POLICY IF EXISTS "academic_outlines_all_own" ON public.academic_outlines';
  EXECUTE 'CREATE POLICY "academic_outlines_all_own" ON public.academic_outlines FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';

  EXECUTE 'DROP POLICY IF EXISTS "academic_papers_all_own" ON public.academic_papers';
  EXECUTE 'CREATE POLICY "academic_papers_all_own" ON public.academic_papers FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';

  EXECUTE 'DROP POLICY IF EXISTS "emergency_skips_all_own" ON public.emergency_skips';
  EXECUTE 'CREATE POLICY "emergency_skips_all_own" ON public.emergency_skips FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';

  EXECUTE 'DROP POLICY IF EXISTS "syllabi_all_own" ON public.syllabi';
  EXECUTE 'CREATE POLICY "syllabi_all_own" ON public.syllabi FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';

  EXECUTE 'DROP POLICY IF EXISTS "assignments_all_own" ON public.assignments';
  EXECUTE 'CREATE POLICY "assignments_all_own" ON public.assignments FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';

  EXECUTE 'DROP POLICY IF EXISTS "assignment_overrides_all_own" ON public.assignment_overrides';
  EXECUTE 'CREATE POLICY "assignment_overrides_all_own" ON public.assignment_overrides FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';

  EXECUTE 'DROP POLICY IF EXISTS "syllabus_assignment_drafts_all_own" ON public.syllabus_assignment_drafts';
  EXECUTE 'CREATE POLICY "syllabus_assignment_drafts_all_own" ON public.syllabus_assignment_drafts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';

  EXECUTE 'DROP POLICY IF EXISTS "syllabus_approval_events_all_own" ON public.syllabus_approval_events';
  EXECUTE 'CREATE POLICY "syllabus_approval_events_all_own" ON public.syllabus_approval_events FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';

  EXECUTE 'DROP POLICY IF EXISTS "study_materials_all_own" ON public.study_materials';
  EXECUTE 'CREATE POLICY "study_materials_all_own" ON public.study_materials FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';

  EXECUTE 'DROP POLICY IF EXISTS "quizzes_all_own" ON public.quizzes';
  EXECUTE 'CREATE POLICY "quizzes_all_own" ON public.quizzes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';

  EXECUTE 'DROP POLICY IF EXISTS "quiz_attempts_all_own" ON public.quiz_attempts';
  EXECUTE 'CREATE POLICY "quiz_attempts_all_own" ON public.quiz_attempts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';

  -- coding_review shared catalog tables
  EXECUTE 'DROP POLICY IF EXISTS "coding_paths_read" ON coding_review.paths';
  EXECUTE 'CREATE POLICY "coding_paths_read" ON coding_review.paths FOR SELECT USING (auth.role() IN (''authenticated'', ''service_role''))';
  EXECUTE 'DROP POLICY IF EXISTS "coding_paths_admin_write" ON coding_review.paths';
  EXECUTE 'CREATE POLICY "coding_paths_admin_write" ON coding_review.paths FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')';

  EXECUTE 'DROP POLICY IF EXISTS "coding_lessons_read" ON coding_review.lessons';
  EXECUTE 'CREATE POLICY "coding_lessons_read" ON coding_review.lessons FOR SELECT USING (auth.role() IN (''authenticated'', ''service_role''))';
  EXECUTE 'DROP POLICY IF EXISTS "coding_lessons_admin_write" ON coding_review.lessons';
  EXECUTE 'CREATE POLICY "coding_lessons_admin_write" ON coding_review.lessons FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')';

  EXECUTE 'DROP POLICY IF EXISTS "coding_templates_read" ON coding_review.templates';
  EXECUTE 'CREATE POLICY "coding_templates_read" ON coding_review.templates FOR SELECT USING (auth.role() IN (''authenticated'', ''service_role''))';
  EXECUTE 'DROP POLICY IF EXISTS "coding_templates_admin_write" ON coding_review.templates';
  EXECUTE 'CREATE POLICY "coding_templates_admin_write" ON coding_review.templates FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')';

  -- coding_review user-owned tables
  EXECUTE 'DROP POLICY IF EXISTS "coding_sessions_all_own" ON coding_review.sessions';
  EXECUTE 'CREATE POLICY "coding_sessions_all_own" ON coding_review.sessions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';

  EXECUTE 'DROP POLICY IF EXISTS "coding_submissions_all_own" ON coding_review.submissions';
  EXECUTE 'CREATE POLICY "coding_submissions_all_own" ON coding_review.submissions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';

  EXECUTE 'DROP POLICY IF EXISTS "coding_placements_all_own" ON coding_review.placements';
  EXECUTE 'CREATE POLICY "coding_placements_all_own" ON coding_review.placements FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';

  EXECUTE 'DROP POLICY IF EXISTS "coding_path_progress_all_own" ON coding_review.path_progress';
  EXECUTE 'CREATE POLICY "coding_path_progress_all_own" ON coding_review.path_progress FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';

  EXECUTE 'DROP POLICY IF EXISTS "coding_checkpoint_reviews_all_own" ON coding_review.checkpoint_reviews';
  EXECUTE 'CREATE POLICY "coding_checkpoint_reviews_all_own" ON coding_review.checkpoint_reviews FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
END
$$;
