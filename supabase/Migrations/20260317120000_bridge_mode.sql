ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS bridge_mode_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS bridge_mode_source_language TEXT,
  ADD COLUMN IF NOT EXISTS bridge_mode_target_language TEXT NOT NULL DEFAULT 'en';

CREATE TABLE IF NOT EXISTS public.bridge_mode_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  studio TEXT NOT NULL CHECK (studio IN ('academic', 'career', 'mirror')),
  source_language TEXT NOT NULL,
  target_language TEXT NOT NULL DEFAULT 'en',
  source_input TEXT NOT NULL,
  english_output TEXT NOT NULL,
  profile_version INTEGER NOT NULL CHECK (profile_version IN (1, 2)),
  ursie_reflection TEXT,
  ursie_reflection_language TEXT,
  reflection_viewed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.bridge_mode_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'bridge_mode_sessions'
      AND policyname = 'Users can read their own bridge sessions'
  ) THEN
    CREATE POLICY "Users can read their own bridge sessions"
      ON public.bridge_mode_sessions FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'bridge_mode_sessions'
      AND policyname = 'Users can insert their own bridge sessions'
  ) THEN
    CREATE POLICY "Users can insert their own bridge sessions"
      ON public.bridge_mode_sessions FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'bridge_mode_sessions'
      AND policyname = 'Users can update their own bridge sessions'
  ) THEN
    CREATE POLICY "Users can update their own bridge sessions"
      ON public.bridge_mode_sessions FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bridge_sessions_user_reflection
  ON public.bridge_mode_sessions(user_id, reflection_viewed, created_at DESC);
