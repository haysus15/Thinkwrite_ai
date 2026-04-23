-- ============================================================
-- Sprint: Multi-Language Mirror Mode Engine
-- Add language fields to mirror_documents and create
-- mirror_language_profiles for per-language fingerprints.
-- ============================================================

ALTER TABLE public.mirror_documents
  ADD COLUMN IF NOT EXISTS language TEXT,
  ADD COLUMN IF NOT EXISTS language_confidence FLOAT,
  ADD COLUMN IF NOT EXISTS language_override TEXT,
  ADD COLUMN IF NOT EXISTS is_cross_language_output BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.mirror_extension_activity
  ADD COLUMN IF NOT EXISTS document_id UUID NULL REFERENCES public.mirror_documents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_mirror_documents_language
  ON public.mirror_documents(user_id, language)
  WHERE excluded_from_profile = FALSE;

CREATE INDEX IF NOT EXISTS idx_mirror_extension_activity_document
  ON public.mirror_extension_activity(document_id);

CREATE TABLE IF NOT EXISTS public.mirror_language_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  fingerprint JSONB NOT NULL DEFAULT '{}'::jsonb,
  document_count INTEGER NOT NULL DEFAULT 0,
  confidence_tier TEXT NOT NULL DEFAULT 'emerging'
    CHECK (confidence_tier IN ('emerging', 'developing', 'established')),
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, language)
);

ALTER TABLE public.mirror_language_profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'mirror_language_profiles'
      AND policyname = 'Users can read their own language profiles'
  ) THEN
    CREATE POLICY "Users can read their own language profiles"
      ON public.mirror_language_profiles
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'mirror_language_profiles'
      AND policyname = 'Users can insert their own language profiles'
  ) THEN
    CREATE POLICY "Users can insert their own language profiles"
      ON public.mirror_language_profiles
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'mirror_language_profiles'
      AND policyname = 'Users can update their own language profiles'
  ) THEN
    CREATE POLICY "Users can update their own language profiles"
      ON public.mirror_language_profiles
      FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
END $$;
