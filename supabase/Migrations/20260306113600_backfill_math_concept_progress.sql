-- Global backfill of math_concept_progress from existing math_steps/math_problems data.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'math_concept_progress'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'math_steps'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'math_problems'
  ) THEN
    INSERT INTO public.math_concept_progress (
      user_id,
      concept,
      times_encountered,
      times_correct,
      times_error,
      last_encountered,
      mastery_level
    )
    SELECT
      s.user_id,
      COALESCE(NULLIF(p.problem_type, ''), 'general') AS concept,
      COUNT(*)::int AS times_encountered,
      COUNT(*) FILTER (
        WHERE s.status IN ('correct', 'equivalent_form')
      )::int AS times_correct,
      COUNT(*) FILTER (
        WHERE s.status IN ('incorrect', 'error', 'partial')
      )::int AS times_error,
      MAX(COALESCE(s.verified_at, s.created_at)) AS last_encountered,
      LEAST(
        100,
        GREATEST(
          0,
          ROUND(
            (
              (COUNT(*) FILTER (WHERE s.status IN ('correct', 'equivalent_form'))::numeric)
              / NULLIF(COUNT(*)::numeric, 0)
            ) * 100
          )::int
        )
      ) AS mastery_level
    FROM public.math_steps s
    JOIN public.math_problems p ON p.id = s.problem_id
    GROUP BY s.user_id, COALESCE(NULLIF(p.problem_type, ''), 'general')
    ON CONFLICT (user_id, concept) DO UPDATE
    SET
      times_encountered = EXCLUDED.times_encountered,
      times_correct = EXCLUDED.times_correct,
      times_error = EXCLUDED.times_error,
      last_encountered = EXCLUDED.last_encountered,
      mastery_level = EXCLUDED.mastery_level;
  END IF;
END
$$;
