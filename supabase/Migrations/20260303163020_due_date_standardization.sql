-- Migration: due_date_standardization
-- Changes due_date columns from timestamp to date where time is not meaningful.
-- Prevents timezone drift in Travis weekly grouping and "due soon" logic.

ALTER TABLE assignments
  ALTER COLUMN due_date TYPE date
  USING due_date::date;

ALTER TABLE syllabus_assignment_drafts
  ALTER COLUMN due_date TYPE date
  USING due_date::date;