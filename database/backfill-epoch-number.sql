-- Backfill epoch_number for existing mirror_documents with NULL epoch_number.
-- Strategy: assign the current open epoch for each user; if none, assign 1.
-- NOTE: This is approximate for historical documents.

WITH current_epochs AS (
  SELECT user_id, COALESCE(MAX(epoch_number), 1) AS epoch_number
  FROM voice_profile_epochs
  WHERE ended_at IS NULL
  GROUP BY user_id
)
UPDATE mirror_documents md
SET epoch_number = COALESCE(ce.epoch_number, 1)
FROM current_epochs ce
WHERE md.epoch_number IS NULL
  AND md.user_id = ce.user_id;

-- For users without any epoch rows at all, default to epoch 1
UPDATE mirror_documents md
SET epoch_number = 1
WHERE md.epoch_number IS NULL;
