-- Mirror Mode core schema upgrades (epochs + soft delete)

-- Add soft delete + epoch fields to documents
alter table if exists mirror_documents
  add column if not exists deleted_at timestamptz,
  add column if not exists visibility_status text default 'active',
  add column if not exists epoch_number integer default 1;

-- Optional: enforce visibility values if desired
-- alter table mirror_documents
--   add constraint mirror_documents_visibility_check
--   check (visibility_status in ('active','hidden','purged'));

-- Epoch archive table
create table if not exists voice_profile_epochs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  epoch_number integer not null,
  started_at timestamptz default now(),
  ended_at timestamptz,
  archived_profile_data jsonb,
  reason text check (reason in ('user_reset','user_requested_purge'))
);

create index if not exists voice_profile_epochs_user_idx on voice_profile_epochs(user_id);
create index if not exists voice_profile_epochs_user_epoch_idx on voice_profile_epochs(user_id, epoch_number);
