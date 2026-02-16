-- Ursie's observations (visible in Mirror Mode)

create table if not exists ursie_observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  observation_type text check (observation_type in ('pattern','evolution','cross_chamber','chamber_gap','upload_response','lineage_insight')),
  chamber text,
  observation_text text not null,
  generated_at timestamptz default now(),
  dismissed boolean default false
);

create index if not exists ursie_observations_user_idx on ursie_observations(user_id);
