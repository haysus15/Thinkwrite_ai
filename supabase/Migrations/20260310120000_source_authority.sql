-- Mirror Mode source authority tagging + profile exclusion gates

ALTER TABLE mirror_documents
ADD COLUMN IF NOT EXISTS source_authority TEXT NOT NULL DEFAULT 'unknown'
  CHECK (source_authority IN (
    'user_typed',
    'user_uploaded',
    'user_quickstart',
    'ai_generated_accepted',
    'ai_generated_rejected',
    'extension_captured',
    'unknown'
  ));

COMMENT ON COLUMN mirror_documents.source_authority IS
  'Origin of the text. Only user_typed, user_uploaded, user_quickstart, and extension_captured feed the voice profile. AI-generated sources are stored but excluded from aggregation.';

ALTER TABLE mirror_documents
ADD COLUMN IF NOT EXISTS excluded_from_profile BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN mirror_documents.excluded_from_profile IS
  'When true, this document does not contribute to voice profile aggregation. Set automatically based on source_authority.';

ALTER TABLE mirror_extension_activity
ADD COLUMN IF NOT EXISTS source_authority TEXT NOT NULL DEFAULT 'extension_captured';
