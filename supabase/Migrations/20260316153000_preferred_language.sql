ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'en';
