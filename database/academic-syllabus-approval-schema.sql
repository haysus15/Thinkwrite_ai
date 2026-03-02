-- Academic Studio syllabus approval + assignment archival schema
-- This migration is idempotent and designed for Supabase Postgres.

create extension if not exists pgcrypto;

-- 1) Extend existing syllabi with explicit lifecycle state.
alter table if exists public.syllabi
  add column if not exists status text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists parse_confidence numeric(5,4),
  add column if not exists parser_version text,
  add column if not exists term text,
  add column if not exists section text;

update public.syllabi
set status = case
  when confirmed = true then 'approved'
  else 'draft'
end
where status is null;

alter table if exists public.syllabi
  alter column status set default 'draft';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'syllabi_status_check'
      and conrelid = 'public.syllabi'::regclass
  ) then
    alter table public.syllabi
      add constraint syllabi_status_check
      check (status in ('uploaded', 'parsed', 'draft', 'approved', 'archived'));
  end if;
end $$;

-- 2) Draft rows extracted from parser and user-edited before publish.
create table if not exists public.syllabus_assignment_drafts (
  id uuid primary key default gen_random_uuid(),
  syllabus_id uuid not null references public.syllabi(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  class_name text not null,
  assignment_name text not null,
  assignment_type text,
  due_date timestamptz,
  requirements jsonb,
  grading_weight numeric(6,4),
  draft_status text not null default 'parsed',
  parser_confidence numeric(5,4),
  parser_notes text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists syllabus_assignment_drafts_user_idx
  on public.syllabus_assignment_drafts(user_id, syllabus_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'syllabus_assignment_drafts_status_check'
      and conrelid = 'public.syllabus_assignment_drafts'::regclass
  ) then
    alter table public.syllabus_assignment_drafts
      add constraint syllabus_assignment_drafts_status_check
      check (draft_status in ('parsed', 'edited', 'approved', 'rejected', 'published'));
  end if;
end $$;

-- 3) Approval events are immutable audit records.
create table if not exists public.syllabus_approval_events (
  id uuid primary key default gen_random_uuid(),
  syllabus_id uuid not null references public.syllabi(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  approved_at timestamptz not null default now(),
  notes text,
  assignments_created integer not null default 0,
  assignments_archived integer not null default 0,
  event_payload jsonb
);

create index if not exists syllabus_approval_events_syllabus_idx
  on public.syllabus_approval_events(syllabus_id, approved_at desc);

-- 4) Assignment-level change log for post-approval direct edits.
create table if not exists public.assignment_change_log (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  changed_at timestamptz not null default now(),
  change_type text not null default 'update',
  changed_fields text[] not null default '{}',
  old_data jsonb,
  new_data jsonb,
  reason text
);

create index if not exists assignment_change_log_assignment_idx
  on public.assignment_change_log(assignment_id, changed_at desc);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'assignment_change_log_change_type_check'
      and conrelid = 'public.assignment_change_log'::regclass
  ) then
    alter table public.assignment_change_log
      add constraint assignment_change_log_change_type_check
      check (change_type in ('create', 'update', 'archive', 'unarchive', 'delete'));
  end if;
end $$;

-- 5) Extend assignments for archival + provenance.
alter table if exists public.assignments
  add column if not exists updated_at timestamptz default now(),
  add column if not exists archived_at timestamptz,
  add column if not exists archived_reason text,
  add column if not exists source_draft_id uuid references public.syllabus_assignment_drafts(id) on delete set null,
  add column if not exists last_approved_at timestamptz,
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

create index if not exists assignments_active_due_idx
  on public.assignments(user_id, due_date asc)
  where completed = false and archived_at is null;

create index if not exists assignments_class_active_idx
  on public.assignments(user_id, class_name)
  where archived_at is null;

-- Keep updated_at current for drafts.
create or replace function public.touch_syllabus_assignment_drafts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_syllabus_assignment_drafts_updated_at
  on public.syllabus_assignment_drafts;

create trigger trg_touch_syllabus_assignment_drafts_updated_at
before update on public.syllabus_assignment_drafts
for each row
execute procedure public.touch_syllabus_assignment_drafts_updated_at();

-- Mandatory approval gate: cannot mark syllabus approved without approved draft rows.
create or replace function public.enforce_syllabus_has_approved_drafts()
returns trigger
language plpgsql
as $$
declare
  v_count integer;
begin
  if new.status = 'approved' then
    select count(*)
      into v_count
    from public.syllabus_assignment_drafts d
    where d.syllabus_id = new.id
      and d.user_id = new.user_id
      and d.draft_status in ('approved', 'published');

    if coalesce(v_count, 0) = 0 then
      raise exception 'Cannot approve syllabus % without approved assignment drafts.', new.id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_syllabus_has_approved_drafts
  on public.syllabi;

create trigger trg_enforce_syllabus_has_approved_drafts
before update of status on public.syllabi
for each row
execute procedure public.enforce_syllabus_has_approved_drafts();

-- Main publish function:
-- - archives prior active assignments for same user + class
-- - creates assignments from approved drafts
-- - marks syllabus approved
-- - writes approval event and change logs
create or replace function public.publish_syllabus_approval(
  p_syllabus_id uuid,
  p_user_id uuid,
  p_notes text default null
)
returns table(assignments_created integer, assignments_archived integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class_name text;
  v_created integer := 0;
  v_archived integer := 0;
begin
  select s.class_name
    into v_class_name
  from public.syllabi s
  where s.id = p_syllabus_id
    and s.user_id = p_user_id
  for update;

  if v_class_name is null then
    raise exception 'Syllabus % not found for user %.', p_syllabus_id, p_user_id;
  end if;

  with archived as (
    update public.assignments a
    set archived_at = now(),
        archived_reason = 'replaced_by_syllabus:' || p_syllabus_id::text,
        updated_at = now(),
        updated_by = p_user_id
    where a.user_id = p_user_id
      and a.archived_at is null
      and (
        -- Always replace prior active rows from this same syllabus (re-publish case)
        a.syllabus_id = p_syllabus_id
        or
        -- Replace rows from earlier syllabus versions with class-name variations normalized
        (
          a.syllabus_id is not null
          and exists (
            select 1
            from public.syllabi s2
            where s2.id = a.syllabus_id
              and s2.user_id = p_user_id
              and lower(regexp_replace(coalesce(s2.class_name, ''), '\s+', '', 'g')) =
                  lower(regexp_replace(coalesce(v_class_name, ''), '\s+', '', 'g'))
          )
        )
        or
        -- Fallback for manual assignments lacking syllabus_id
        lower(regexp_replace(coalesce(a.class_name, ''), '\s+', '', 'g')) =
        lower(regexp_replace(coalesce(v_class_name, ''), '\s+', '', 'g'))
      )
    returning a.id
  )
  select count(*) into v_archived from archived;

  with inserted as (
    insert into public.assignments (
      user_id,
      syllabus_id,
      class_name,
      assignment_name,
      assignment_type,
      due_date,
      requirements,
      grading_weight,
      completed,
      archived_at,
      source_draft_id,
      last_approved_at,
      updated_by
    )
    select
      d.user_id,
      d.syllabus_id,
      d.class_name,
      d.assignment_name,
      d.assignment_type,
      d.due_date,
      d.requirements,
      d.grading_weight,
      false,
      null,
      d.id,
      now(),
      p_user_id
    from public.syllabus_assignment_drafts d
    where d.syllabus_id = p_syllabus_id
      and d.user_id = p_user_id
      and d.draft_status = 'approved'
    returning id
  )
  select count(*) into v_created from inserted;

  if v_created = 0 then
    raise exception 'No approved assignment drafts found for syllabus %.', p_syllabus_id;
  end if;

  update public.syllabus_assignment_drafts
  set draft_status = 'published',
      updated_at = now()
  where syllabus_id = p_syllabus_id
    and user_id = p_user_id
    and draft_status = 'approved';

  update public.syllabi
  set confirmed = true,
      status = 'approved',
      reviewed_at = now(),
      reviewed_by = p_user_id
  where id = p_syllabus_id
    and user_id = p_user_id;

  insert into public.syllabus_approval_events (
    syllabus_id,
    user_id,
    notes,
    assignments_created,
    assignments_archived,
    event_payload
  )
  values (
    p_syllabus_id,
    p_user_id,
    p_notes,
    v_created,
    v_archived,
    jsonb_build_object(
      'class_name', v_class_name,
      'approved_at', now()
    )
  );

  assignments_created := v_created;
  assignments_archived := v_archived;
  return next;
end;
$$;

revoke all on function public.publish_syllabus_approval(uuid, uuid, text) from public;
grant execute on function public.publish_syllabus_approval(uuid, uuid, text) to authenticated;

-- Trigger-based assignment audit (works for direct user edits after approval).
create or replace function public.log_assignment_change()
returns trigger
language plpgsql
as $$
declare
  v_user_id uuid;
  v_fields text[];
  v_change_type text;
begin
  if tg_op = 'INSERT' then
    v_user_id := new.user_id;
    v_change_type := 'create';
    insert into public.assignment_change_log (
      assignment_id, user_id, change_type, changed_fields, old_data, new_data
    )
    values (
      new.id, v_user_id, v_change_type, array['*'], null, to_jsonb(new)
    );
    return new;
  end if;

  if tg_op = 'UPDATE' then
    v_user_id := coalesce(new.user_id, old.user_id);
    v_fields := array_remove(array[
      case when old.class_name        is distinct from new.class_name then 'class_name' end,
      case when old.assignment_name   is distinct from new.assignment_name then 'assignment_name' end,
      case when old.assignment_type   is distinct from new.assignment_type then 'assignment_type' end,
      case when old.due_date          is distinct from new.due_date then 'due_date' end,
      case when old.requirements      is distinct from new.requirements then 'requirements' end,
      case when old.grading_weight    is distinct from new.grading_weight then 'grading_weight' end,
      case when old.completed         is distinct from new.completed then 'completed' end,
      case when old.archived_at       is distinct from new.archived_at then 'archived_at' end,
      case when old.archived_reason   is distinct from new.archived_reason then 'archived_reason' end
    ], null);

    if coalesce(array_length(v_fields, 1), 0) > 0 then
      v_change_type := case
        when old.archived_at is null and new.archived_at is not null then 'archive'
        when old.archived_at is not null and new.archived_at is null then 'unarchive'
        else 'update'
      end;

      insert into public.assignment_change_log (
        assignment_id, user_id, change_type, changed_fields, old_data, new_data
      )
      values (
        new.id, v_user_id, v_change_type, v_fields, to_jsonb(old), to_jsonb(new)
      );
    end if;

    return new;
  end if;

  v_user_id := old.user_id;
  insert into public.assignment_change_log (
    assignment_id, user_id, change_type, changed_fields, old_data, new_data
  )
  values (
    old.id, v_user_id, 'delete', array['*'], to_jsonb(old), null
  );
  return old;
end;
$$;

drop trigger if exists trg_log_assignment_change on public.assignments;
create trigger trg_log_assignment_change
after insert or update or delete on public.assignments
for each row
execute procedure public.log_assignment_change();

-- RLS for new tables.
alter table public.syllabus_assignment_drafts enable row level security;
alter table public.syllabus_approval_events enable row level security;
alter table public.assignment_change_log enable row level security;

drop policy if exists "Users can view their syllabus drafts" on public.syllabus_assignment_drafts;
create policy "Users can view their syllabus drafts"
  on public.syllabus_assignment_drafts
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their syllabus drafts" on public.syllabus_assignment_drafts;
create policy "Users can insert their syllabus drafts"
  on public.syllabus_assignment_drafts
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their syllabus drafts" on public.syllabus_assignment_drafts;
create policy "Users can update their syllabus drafts"
  on public.syllabus_assignment_drafts
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their syllabus drafts" on public.syllabus_assignment_drafts;
create policy "Users can delete their syllabus drafts"
  on public.syllabus_assignment_drafts
  for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can view their syllabus approvals" on public.syllabus_approval_events;
create policy "Users can view their syllabus approvals"
  on public.syllabus_approval_events
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their syllabus approvals" on public.syllabus_approval_events;
create policy "Users can insert their syllabus approvals"
  on public.syllabus_approval_events
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can view their assignment change log" on public.assignment_change_log;
create policy "Users can view their assignment change log"
  on public.assignment_change_log
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their assignment change log" on public.assignment_change_log;
create policy "Users can insert their assignment change log"
  on public.assignment_change_log
  for insert
  with check (auth.uid() = user_id);
