-- ============================================================
-- Sprint: Avatar + Settings
-- Add avatar_color, update handler to write it, backfill users
-- NOTE: __handle_new_user__ trigger already dropped manually.
--       Do not add a DROP TRIGGER step here.
-- ============================================================

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS avatar_color TEXT NULL;

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
  );
  RETURN NEW;
END;
$$;

UPDATE public.users
SET avatar_color = (
  ARRAY[
    '#5B6EAE',
    '#7E5BAE',
    '#AE5B8A',
    '#5BAE8A',
    '#AE8A5B',
    '#5B9AAE',
    '#8AAE5B',
    '#AE5B5B'
  ])[
    (
      COALESCE((
        SELECT SUM(ASCII(SUBSTRING(COALESCE(name, ''), gs.i, 1)))
        FROM generate_series(1, GREATEST(LENGTH(COALESCE(name, 'u')), 1)) AS gs(i)
        WHERE gs.i <= LENGTH(COALESCE(name, 'u'))
      ), 0) % 8
    ) + 1
  ]
WHERE avatar_color IS NULL;
