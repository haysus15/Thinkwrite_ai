ALTER TABLE IF EXISTS public.emergency_skips
ADD COLUMN IF NOT EXISTS feature text NOT NULL DEFAULT 'paper';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'emergency_skips_feature_check'
      AND conrelid = 'public.emergency_skips'::regclass
  ) THEN
    ALTER TABLE public.emergency_skips
      DROP CONSTRAINT emergency_skips_feature_check;
  END IF;
END $$;

ALTER TABLE public.emergency_skips
  ADD CONSTRAINT emergency_skips_feature_check
  CHECK (feature IN ('paper', 'coding_review'));

UPDATE public.emergency_skips
SET feature = 'paper'
WHERE feature IS NULL OR feature = '';
