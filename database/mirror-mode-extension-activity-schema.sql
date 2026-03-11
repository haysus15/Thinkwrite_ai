create table if not exists public.mirror_extension_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  hostname text not null,
  chamber text not null check (chamber in ('career', 'academic', 'creative', 'general')),
  session_id text not null,
  word_count integer not null default 0,
  fingerprint jsonb,
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists mirror_extension_activity_user_idx
  on public.mirror_extension_activity(user_id, captured_at desc);

create index if not exists mirror_extension_activity_host_idx
  on public.mirror_extension_activity(user_id, hostname);

alter table public.mirror_extension_activity enable row level security;

create policy if not exists "Users can read own extension activity"
  on public.mirror_extension_activity for select
  using (auth.uid() = user_id);

create policy if not exists "Users can insert own extension activity"
  on public.mirror_extension_activity for insert
  with check (auth.uid() = user_id);
