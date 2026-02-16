-- Mirror Mode studio consent history (append-only)
-- database/mirror-mode-consent-history-schema.sql

CREATE TABLE IF NOT EXISTS mirror_mode_consent_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  studio TEXT NOT NULL CHECK (studio IN ('career', 'academic', 'creative')),
  consented_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL DEFAULT 'studio_modal',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE mirror_mode_consent_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their consent history"
  ON mirror_mode_consent_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their consent history"
  ON mirror_mode_consent_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);
