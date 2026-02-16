-- Cross-chamber blending consent (future feature scaffolding)
-- database/mirror-mode-blend-consent-schema.sql

CREATE TABLE IF NOT EXISTS mirror_mode_blend_consent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  from_chamber TEXT NOT NULL CHECK (from_chamber IN ('career', 'academic', 'creative', 'general')),
  to_chamber TEXT NOT NULL CHECK (to_chamber IN ('career', 'academic', 'creative', 'general')),
  scope TEXT NOT NULL CHECK (scope IN ('one_time', 'session', 'persistent')) DEFAULT 'one_time',
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE mirror_mode_blend_consent ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view blend consent"
  ON mirror_mode_blend_consent FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert blend consent"
  ON mirror_mode_blend_consent FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update blend consent"
  ON mirror_mode_blend_consent FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
