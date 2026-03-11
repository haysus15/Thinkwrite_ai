-- Migration: add_telemetry_events
-- Academic Studio telemetry table for generation quality and failures.

CREATE TABLE IF NOT EXISTS public.telemetry_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  workspace text,
  severity text NOT NULL DEFAULT 'info',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.telemetry_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own telemetry" ON public.telemetry_events;
DROP POLICY IF EXISTS "Users can read own telemetry" ON public.telemetry_events;
DROP POLICY IF EXISTS "Admin reads all telemetry" ON public.telemetry_events;

CREATE POLICY "Users can insert own telemetry"
  ON public.telemetry_events
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own telemetry"
  ON public.telemetry_events
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admin reads all telemetry"
  ON public.telemetry_events
  FOR SELECT
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS telemetry_events_event_type_idx
  ON public.telemetry_events(event_type);

CREATE INDEX IF NOT EXISTS telemetry_events_created_at_idx
  ON public.telemetry_events(created_at DESC);

CREATE INDEX IF NOT EXISTS telemetry_events_workspace_idx
  ON public.telemetry_events(workspace);

ALTER TABLE public.telemetry_events
  DROP CONSTRAINT IF EXISTS telemetry_events_event_type_check;

ALTER TABLE public.telemetry_events
  ADD CONSTRAINT telemetry_events_event_type_check
  CHECK (event_type = ANY (ARRAY[
    'quiz_generation_failed',
    'quiz_generation_low_quality',
    'study_guide_below_threshold',
    'study_guide_retry_succeeded',
    'study_guide_retry_failed',
    'assignment_parse_error',
    'assignment_parse_low_confidence',
    'user_drop_off',
    'paper_generation_failed',
    'paper_requirements_failed'
  ]));

ALTER TABLE public.telemetry_events
  DROP CONSTRAINT IF EXISTS telemetry_events_severity_check;

ALTER TABLE public.telemetry_events
  ADD CONSTRAINT telemetry_events_severity_check
  CHECK (severity = ANY (ARRAY['info', 'warn', 'error']));
