-- Mirror Mode UX overhaul support fields
-- Canonical runtime tables for this feature:
--   public.user_profiles
--   public.voice_chambers

create table if not exists public.user_profiles (
  user_id uuid primary key references public.users(id) on delete cascade,
  mirror_mode_first_visit boolean not null default true,
  quickstart_samples_count integer not null default 0,
  mirror_roadmap_dismissed jsonb not null default '{"career":false,"academic":false,"creative":false,"general":false}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.user_profiles
  add column if not exists mirror_mode_first_visit boolean default true,
  add column if not exists quickstart_samples_count integer default 0,
  add column if not exists mirror_roadmap_dismissed jsonb default '{"career":false,"academic":false,"creative":false,"general":false}'::jsonb,
  add column if not exists updated_at timestamptz default now();

create table if not exists public.voice_chambers (
  user_id uuid not null references public.users(id) on delete cascade,
  chamber text not null check (chamber in ('career','academic','creative','general','overall')),
  aggregate_fingerprint jsonb,
  confidence_level float,
  document_count integer,
  total_word_count integer,
  last_trained_at timestamptz,
  evolution_history jsonb,
  roadmap_dismissed boolean not null default false,
  last_momentum_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, chamber)
);

create index if not exists voice_chambers_user_idx on public.voice_chambers(user_id);

alter table if exists public.voice_chambers
  add column if not exists roadmap_dismissed boolean default false,
  add column if not exists last_momentum_at timestamptz,
  add column if not exists updated_at timestamptz default now();

-- Backfill canonical tables from legacy sources when present.
do $$
begin
  if to_regclass('public.user_onboarding') is not null then
    alter table public.user_onboarding
      add column if not exists mirror_mode_first_visit boolean default true,
      add column if not exists quickstart_samples_count integer default 0,
      add column if not exists mirror_roadmap_dismissed jsonb default '{"career":false,"academic":false,"creative":false,"general":false}'::jsonb;

    insert into public.user_profiles (user_id, mirror_mode_first_visit, quickstart_samples_count, mirror_roadmap_dismissed, updated_at)
    select
      uo.user_id,
      coalesce(uo.mirror_mode_first_visit, true),
      coalesce(uo.quickstart_samples_count, 0),
      coalesce(uo.mirror_roadmap_dismissed, '{"career":false,"academic":false,"creative":false,"general":false}'::jsonb),
      now()
    from public.user_onboarding uo
    on conflict (user_id) do update
    set
      mirror_mode_first_visit = excluded.mirror_mode_first_visit,
      quickstart_samples_count = excluded.quickstart_samples_count,
      mirror_roadmap_dismissed = excluded.mirror_roadmap_dismissed,
      updated_at = now();
  end if;
end $$;

do $$
begin
  if to_regclass('public.voice_profiles_chambers') is not null then
    insert into public.voice_chambers (
      user_id,
      chamber,
      aggregate_fingerprint,
      confidence_level,
      document_count,
      total_word_count,
      last_trained_at,
      evolution_history,
      updated_at
    )
    select
      vpc.user_id,
      vpc.chamber,
      vpc.aggregate_fingerprint,
      vpc.confidence_level,
      vpc.document_count,
      vpc.total_word_count,
      vpc.last_trained_at,
      vpc.evolution_history,
      coalesce(vpc.updated_at, now())
    from public.voice_profiles_chambers vpc
    on conflict (user_id, chamber) do update
    set
      aggregate_fingerprint = excluded.aggregate_fingerprint,
      confidence_level = excluded.confidence_level,
      document_count = excluded.document_count,
      total_word_count = excluded.total_word_count,
      last_trained_at = excluded.last_trained_at,
      evolution_history = excluded.evolution_history,
      updated_at = now();
  end if;
end $$;
