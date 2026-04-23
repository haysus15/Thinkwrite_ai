ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_profiles'
      AND policyname = 'Users can read own user profile'
  ) THEN
    CREATE POLICY "Users can read own user profile"
      ON public.user_profiles
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_profiles'
      AND policyname = 'Users can insert own user profile'
  ) THEN
    CREATE POLICY "Users can insert own user profile"
      ON public.user_profiles
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_profiles'
      AND policyname = 'Users can update own user profile'
  ) THEN
    CREATE POLICY "Users can update own user profile"
      ON public.user_profiles
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

INSERT INTO public.user_profiles (
  user_id,
  preferred_language,
  mirror_mode_first_visit,
  quickstart_samples_count,
  mirror_roadmap_dismissed,
  created_at,
  updated_at
)
SELECT
  u.id,
  'en',
  true,
  0,
  '{"career":false,"academic":false,"creative":false,"general":false}'::jsonb,
  NOW(),
  NOW()
FROM public.users u
LEFT JOIN public.user_profiles up
  ON up.user_id = u.id
WHERE up.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
  v_color TEXT;
  v_colors TEXT[] := ARRAY[
    '#5B6EAE',
    '#7E5BAE',
    '#AE5B8A',
    '#5BAE8A',
    '#AE8A5B',
    '#5B9AAE',
    '#8AAE5B',
    '#AE5B5B'
  ];
  v_hash INT;
BEGIN
  v_name := COALESCE(NEW.raw_user_meta_data->>'name', '');

  SELECT SUM(ASCII(SUBSTRING(v_name, gs.i, 1)))
  INTO v_hash
  FROM generate_series(1, GREATEST(LENGTH(v_name), 1)) AS gs(i)
  WHERE gs.i <= LENGTH(v_name);

  v_color := v_colors[(COALESCE(v_hash, 0) % 8) + 1];

  INSERT INTO public.users (id, email, name, avatar_color, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    v_name,
    v_color,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    name = COALESCE(NULLIF(EXCLUDED.name, ''), public.users.name),
    avatar_color = COALESCE(public.users.avatar_color, EXCLUDED.avatar_color),
    updated_at = NOW();

  INSERT INTO public.user_profiles (
    user_id,
    preferred_language,
    mirror_mode_first_visit,
    quickstart_samples_count,
    mirror_roadmap_dismissed,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    'en',
    true,
    0,
    '{"career":false,"academic":false,"creative":false,"general":false}'::jsonb,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET updated_at = NOW();

  RETURN NEW;
END;
$$;
