-- Migration: study_materials_metadata
-- Adds normalized metadata columns to study_materials so origin context
-- is stored properly instead of being crammed into title/class_name/topic.

ALTER TABLE study_materials
  ADD COLUMN IF NOT EXISTS origin_workspace text,
  ADD COLUMN IF NOT EXISTS origin_mode text,
  ADD COLUMN IF NOT EXISTS language text,
  ADD COLUMN IF NOT EXISTS path_id text REFERENCES coding_review.paths(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lesson_index integer,
  ADD COLUMN IF NOT EXISTS material_kind text;

-- Add a check constraint for material_kind
ALTER TABLE study_materials
  ADD CONSTRAINT study_materials_material_kind_check
  CHECK (material_kind = ANY (ARRAY[
    'study_guide',
    'lesson_notes',
    'quiz_source',
    'reference',
    'uploaded_doc'
  ]));

-- Add a check constraint for origin_workspace
ALTER TABLE study_materials
  ADD CONSTRAINT study_materials_origin_workspace_check
  CHECK (origin_workspace = ANY (ARRAY[
    'coding_review',
    'math',
    'study_library',
    'academic',
    'manual'
  ]));