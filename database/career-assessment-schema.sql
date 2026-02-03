-- Career assessment schema
-- Creates the career_assessments table used by the assessment pipeline.

create table if not exists career_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  resume_id uuid references user_documents(id) on delete set null,
  conversation_messages jsonb not null default '[]'::jsonb,
  profile jsonb,
  action_plan jsonb,
  status text not null default 'in_progress',
  started_at timestamptz default now(),
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists career_assessments_user_id_idx
  on career_assessments (user_id);

create index if not exists career_assessments_status_idx
  on career_assessments (status);
