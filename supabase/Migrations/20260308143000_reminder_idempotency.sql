DO $$
DECLARE
  has_sent_at boolean;
  has_created_at boolean;
  has_constraint boolean;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'assignment_reminders'
  ) THEN
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'assignment_reminders'
        AND column_name = 'sent_at'
    ) INTO has_sent_at;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'assignment_reminders'
        AND column_name = 'created_at'
    ) INTO has_created_at;

    ALTER TABLE public.assignment_reminders
      ADD COLUMN IF NOT EXISTS sent_on_date date;

    IF has_sent_at THEN
      UPDATE public.assignment_reminders
      SET sent_on_date = (sent_at AT TIME ZONE 'UTC')::date
      WHERE sent_on_date IS NULL;
    ELSIF has_created_at THEN
      UPDATE public.assignment_reminders
      SET sent_on_date = (created_at AT TIME ZONE 'UTC')::date
      WHERE sent_on_date IS NULL;
    ELSE
      UPDATE public.assignment_reminders
      SET sent_on_date = CURRENT_DATE
      WHERE sent_on_date IS NULL;
    END IF;

    ALTER TABLE public.assignment_reminders
      ALTER COLUMN sent_on_date SET NOT NULL;

    WITH ranked AS (
      SELECT
        id,
        row_number() OVER (
          PARTITION BY assignment_id, user_id, reminder_type, sent_on_date
          ORDER BY created_at ASC, id ASC
        ) AS rn
      FROM public.assignment_reminders
    )
    DELETE FROM public.assignment_reminders ar
    USING ranked
    WHERE ar.id = ranked.id
      AND ranked.rn > 1;

    SELECT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'reminder_unique_per_day'
    ) INTO has_constraint;

    IF NOT has_constraint THEN
      ALTER TABLE public.assignment_reminders
        ADD CONSTRAINT reminder_unique_per_day
        UNIQUE (assignment_id, user_id, reminder_type, sent_on_date);
    END IF;
  END IF;
END
$$;
