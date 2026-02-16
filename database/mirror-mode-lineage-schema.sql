-- Document lineage tracking (cross-studio)

create table if not exists document_lineage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  original_document_id uuid,
  studio_origin text check (studio_origin in ('career','academic','creative','mirror_mode')),
  current_version_id uuid,
  version_history jsonb,
  editorial_decisions jsonb,
  cross_studio_references uuid[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists document_lineage_user_idx on document_lineage(user_id);
