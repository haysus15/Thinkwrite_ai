-- Backfill archived_profile_data for existing epochs using current profile + chamber snapshots.
-- WARNING: This uses current data as an approximation; historical accuracy is not guaranteed.

UPDATE voice_profile_epochs e
SET archived_profile_data = jsonb_build_object(
  'archivedAt', COALESCE((e.archived_profile_data->>'archivedAt')::timestamptz, e.ended_at, NOW()),
  'profile', to_jsonb(vp),
  'chambers', COALESCE(ch.snapshots, '[]'::jsonb),
  'backfilled', true,
  'backfilled_at', NOW(),
  'backfilled_source', 'current_profile'
)
FROM voice_profiles vp
LEFT JOIN (
  SELECT user_id, jsonb_agg(to_jsonb(vpc)) AS snapshots
  FROM voice_profiles_chambers vpc
  GROUP BY user_id
) ch ON ch.user_id = vp.user_id
WHERE e.user_id = vp.user_id
  AND (
    e.archived_profile_data IS NULL
    OR e.archived_profile_data->'profile' IS NULL
    OR e.archived_profile_data->'chambers' IS NULL
  );
