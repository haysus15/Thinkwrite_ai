create table if not exists public.user_onboarding (
  user_id uuid primary key references public.users(id) on delete cascade,
  career_tour_completed_at timestamp,
  academic_tour_completed_at timestamp,
  mirror_tour_completed_at timestamp,
  resume_builder_onboarding_completed_at timestamp,
  resume_builder_onboarding_skipped_at timestamp,
  onboarding_version integer default 1,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

alter table public.user_onboarding enable row level security;

create policy "Users can view their onboarding"
  on public.user_onboarding
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their onboarding"
  on public.user_onboarding
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their onboarding"
  on public.user_onboarding
  for update
  using (auth.uid() = user_id);
