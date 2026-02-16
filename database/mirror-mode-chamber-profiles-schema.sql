-- Chambered voice profiles (career/academic/creative/general/overall)

create table if not exists voice_profiles_chambers (
  user_id uuid not null,
  chamber text not null check (chamber in ('career','academic','creative','general','overall')),
  aggregate_fingerprint jsonb,
  confidence_level float,
  document_count integer,
  total_word_count integer,
  last_trained_at timestamptz,
  evolution_history jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (user_id, chamber)
);

create index if not exists voice_profiles_chambers_user_idx on voice_profiles_chambers(user_id);
