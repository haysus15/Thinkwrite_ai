-- Mirror Mode Ursie chat persistence

create table if not exists mirror_mode_ursie_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text,
  is_saved boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_message_at timestamptz
);

create index if not exists mirror_mode_ursie_sessions_user_idx on mirror_mode_ursie_sessions(user_id);

create table if not exists mirror_mode_ursie_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references mirror_mode_ursie_sessions(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('user','ursie','system')),
  message_text text not null,
  created_at timestamptz default now()
);

create index if not exists mirror_mode_ursie_messages_session_idx on mirror_mode_ursie_messages(session_id);

create table if not exists mirror_mode_ursie_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  session_id uuid references mirror_mode_ursie_sessions(id) on delete set null,
  note text not null,
  created_at timestamptz default now()
);

create index if not exists mirror_mode_ursie_memories_user_idx on mirror_mode_ursie_memories(user_id);

create table if not exists mirror_mode_ursie_preferences (
  user_id uuid primary key,
  memory_prompt_enabled boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
