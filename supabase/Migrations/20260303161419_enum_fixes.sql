-- Migration: enum_fixes
-- Expands check constraints for victor mode, assignment_type, and source_type
-- to match actual app usage and stop silent data loss.

-- 1. VICTOR MODE
-- Adds 'coding_review' which the app uses but currently gets downgraded before DB write.
ALTER TABLE victor_conversations
  DROP CONSTRAINT victor_conversations_mode_check;

ALTER TABLE victor_conversations
  ADD CONSTRAINT victor_conversations_mode_check
  CHECK (mode = ANY (ARRAY[
    'default',
    'idea_expansion',
    'challenge',
    'study',
    'math',
    'coding_review'
  ]));

-- 2. ASSIGNMENT TYPE
-- Adds 'discussion', 'milestone', 'presentation', 'exam' which syllabus parsing
-- produces but currently coerces into wrong categories before save.
ALTER TABLE assignments
  DROP CONSTRAINT assignments_assignment_type_check;

ALTER TABLE assignments
  ADD CONSTRAINT assignments_assignment_type_check
  CHECK (assignment_type = ANY (ARRAY[
    'test',
    'quiz',
    'paper',
    'homework',
    'lab',
    'project',
    'reading',
    'discussion',
    'milestone',
    'presentation',
    'exam'
  ]));

-- 3. STUDY MATERIALS SOURCE TYPE
-- Adds richer source taxonomy so coding review guides, learning coach guides,
-- and other generated content are distinguishable at DB level.
ALTER TABLE study_materials
  DROP CONSTRAINT study_materials_source_type_check;

ALTER TABLE study_materials
  ADD CONSTRAINT study_materials_source_type_check
  CHECK (source_type = ANY (ARRAY[
    'uploaded',
    'generated',
    'from_paper',
    'coding_review_guide',
    'learning_coach_guide',
    'quiz_source',
    'math_guide'
  ]));