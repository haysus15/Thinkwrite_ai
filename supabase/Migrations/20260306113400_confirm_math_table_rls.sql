-- Ensure RLS + user ownership policy on all math tables.
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'math_problems',
    'math_steps',
    'math_guidance',
    'math_work_sessions',
    'math_practice'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = t
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS %I_user_policy ON public.%I', t, t);
      EXECUTE format(
        'CREATE POLICY %I_user_policy ON public.%I FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())',
        t,
        t
      );
    END IF;
  END LOOP;
END
$$;
