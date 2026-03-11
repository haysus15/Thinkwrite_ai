-- Migration: add_teaching_victor_mode
-- Expands victor_conversations mode check to include 'teaching'.

ALTER TABLE victor_conversations
  DROP CONSTRAINT IF EXISTS victor_conversations_mode_check;

ALTER TABLE victor_conversations
  ADD CONSTRAINT victor_conversations_mode_check
  CHECK (mode = ANY (ARRAY[
    'default',
    'idea_expansion',
    'challenge',
    'study',
    'math',
    'coding_review',
    'teaching'
  ]));
