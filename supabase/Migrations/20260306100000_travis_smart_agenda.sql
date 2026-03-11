-- ThinkWrite AI - Travis Smart Agenda (Phase 1)

-- Migration 1: assignments status + priority
ALTER TABLE public.assignments
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'inbox'
CHECK (status IN (
  'inbox',
  'planned',
  'in_progress',
  'ready_to_submit',
  'submitted',
  'completed'
));

UPDATE public.assignments
SET status = 'completed'
WHERE completed = true;

UPDATE public.assignments
SET status = 'inbox'
WHERE completed = false;

ALTER TABLE public.assignments
ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium'
CHECK (priority IN ('low', 'medium', 'high', 'critical'));

CREATE INDEX IF NOT EXISTS assignments_user_status_new_idx
ON public.assignments (user_id, status)
WHERE archived_at IS NULL;

-- Migration 2: assignment_tasks
CREATE TABLE IF NOT EXISTS public.assignment_tasks (
  id             uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  assignment_id  uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_type      text NOT NULL
                 CHECK (task_type IN (
                   'research', 'outline', 'draft', 'revise', 'submit', 'other'
                 )),
  label          text,
  status         text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'in_progress', 'complete')),
  planned_date   date,
  completed_at   timestamptz,
  sort_order     integer DEFAULT 0,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

ALTER TABLE public.assignment_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS assignment_tasks_owner ON public.assignment_tasks;
CREATE POLICY assignment_tasks_owner ON public.assignment_tasks
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS assignment_tasks_assignment_idx
  ON public.assignment_tasks (assignment_id, sort_order);

CREATE INDEX IF NOT EXISTS assignment_tasks_user_date_idx
  ON public.assignment_tasks (user_id, planned_date)
  WHERE status != 'complete';

CREATE OR REPLACE FUNCTION public.set_assignment_tasks_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assignment_tasks_updated_at ON public.assignment_tasks;
CREATE TRIGGER trg_assignment_tasks_updated_at
BEFORE UPDATE ON public.assignment_tasks
FOR EACH ROW
EXECUTE FUNCTION public.set_assignment_tasks_updated_at();

-- Migration 3: assignment_reminders reminder_type += at_risk
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'assignment_reminders'
  ) THEN
    ALTER TABLE public.assignment_reminders
      DROP CONSTRAINT IF EXISTS assignment_reminders_reminder_type_check;

    ALTER TABLE public.assignment_reminders
      ADD CONSTRAINT assignment_reminders_reminder_type_check
      CHECK (reminder_type IN (
        '3_days', '1_day', 'due_today', 'overdue', 'at_risk'
      ));
  END IF;
END
$$;
