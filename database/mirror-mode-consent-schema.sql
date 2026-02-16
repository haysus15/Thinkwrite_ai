-- Mirror Mode studio consent (per studio, one-time)
-- database/mirror-mode-consent-schema.sql

CREATE TABLE IF NOT EXISTS mirror_mode_consent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  studio TEXT NOT NULL CHECK (studio IN ('career', 'academic', 'creative')),
  consented_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, studio)
);

ALTER TABLE mirror_mode_consent ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their consent"
  ON mirror_mode_consent FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert their consent"
  ON mirror_mode_consent FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their consent"
  ON mirror_mode_consent FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
