-- ============================================================
-- Sprint: Full Settings System
-- Add persistent preference columns and studio settings tables
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS default_studio TEXT NULL,
  ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.academic_settings (
  user_id UUID NOT NULL,
  academic_level TEXT NOT NULL DEFAULT 'high_school_standard',
  academic_grade TEXT NULL,
  victor_style TEXT NOT NULL DEFAULT 'balanced',
  subject_areas TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT academic_settings_pkey PRIMARY KEY (user_id),
  CONSTRAINT academic_settings_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.career_settings (
  user_id UUID NOT NULL,
  default_resume_id UUID NULL,
  target_industries TEXT[] NOT NULL DEFAULT '{}',
  target_roles TEXT[] NOT NULL DEFAULT '{}',
  default_cover_letter_tone TEXT NOT NULL DEFAULT 'confident',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT career_settings_pkey PRIMARY KEY (user_id),
  CONSTRAINT career_settings_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE,
  CONSTRAINT career_settings_default_resume_id_fkey
    FOREIGN KEY (default_resume_id) REFERENCES public.user_documents (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.mirror_settings (
  user_id UUID NOT NULL,
  ingestion_policy JSONB NOT NULL DEFAULT '{
    "include_extension": true,
    "include_uploads": true,
    "min_word_count": 50,
    "excluded_domains": []
  }'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT mirror_settings_pkey PRIMARY KEY (user_id),
  CONSTRAINT mirror_settings_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE
);
