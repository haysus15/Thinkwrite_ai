ALTER TABLE assignments
ADD COLUMN IF NOT EXISTS victor_coaching_profile text DEFAULT 'tutor'
CHECK (victor_coaching_profile IN ('tutor', 'critic', 'exam_prep', 'fast_review'));
