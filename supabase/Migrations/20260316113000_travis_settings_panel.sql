-- ============================================================
-- Sprint: Travis Settings Panel
-- Adds travis_settings preference table
-- Does not modify operational Travis tables
-- ============================================================

CREATE TABLE IF NOT EXISTS public.travis_settings (
  user_id             UUID NOT NULL,
  planning_style      TEXT NOT NULL DEFAULT 'balanced',
  agenda_horizon      TEXT NOT NULL DEFAULT 'three_days',
  overdue_emphasis    TEXT NOT NULL DEFAULT 'medium',
  assignment_priority TEXT NOT NULL DEFAULT 'balanced',
  reminder_density    TEXT NOT NULL DEFAULT 'normal',
  subject_weights     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT travis_settings_pkey PRIMARY KEY (user_id),
  CONSTRAINT travis_settings_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE
);
