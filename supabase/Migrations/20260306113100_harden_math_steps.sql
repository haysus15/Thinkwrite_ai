-- Harden math_steps status model and add invalidation timestamp.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'math_steps'
  ) THEN
    ALTER TABLE public.math_steps
      DROP CONSTRAINT IF EXISTS math_steps_status_check;

    ALTER TABLE public.math_steps
      ADD CONSTRAINT math_steps_status_check
      CHECK (status IN (
        'unchecked',
        'correct',
        'equivalent_form',
        'likely_correct',
        'incorrect',
        'needs_recheck'
      ));

    ALTER TABLE public.math_steps
      ADD COLUMN IF NOT EXISTS invalidated_at timestamptz NULL;
  END IF;
END
$$;
