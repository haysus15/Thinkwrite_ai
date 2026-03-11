-- Study materials source_type taxonomy alignment
-- Idempotent migration for Supabase Postgres

-- 1) Backfill legacy values into new taxonomy.
update public.study_materials
set source_type = case
  when source_type = 'uploaded' then 'quiz_source'
  when source_type = 'coding_review_learning_coach' then 'learning_coach_guide'
  else source_type
end
where source_type in ('uploaded', 'coding_review_learning_coach');

update public.study_materials
set source_type = 'quiz_source'
where source_type is null;

-- 2) Replace source_type check constraint with new taxonomy.
do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'study_materials_source_type_check'
      and conrelid = 'public.study_materials'::regclass
  ) then
    alter table public.study_materials
      drop constraint study_materials_source_type_check;
  end if;
end $$;

alter table public.study_materials
  add constraint study_materials_source_type_check
  check (
    source_type in (
      'coding_review_guide',
      'learning_coach_guide',
      'quiz_source',
      'math_guide'
    )
  );

