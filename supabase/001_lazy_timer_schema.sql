-- Lazy Acres Timer v0.1.2 Supabase schema
-- Run this in the Supabase SQL Editor when you are ready to connect the app.
-- These tables are intentionally prefixed with lazy_timer_ because the Supabase project is shared.

create extension if not exists pgcrypto;

create table if not exists public.lazy_timer_project_types (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  default_hourly_rate numeric(10,2) not null default 0,
  is_archived boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.lazy_timer_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  status text not null default 'active',
  project_notes text not null default '',
  project_type_id uuid references public.lazy_timer_project_types(id) on delete set null,
  project_type_name_snapshot text not null default '',
  hourly_rate numeric(10,2) not null default 0,
  is_billable boolean not null default true,
  use_ten_hour_cap boolean not null default true,
  show_on_landing boolean not null default false,
  is_archived boolean not null default false,
  sort_order bigint not null default 0,
  last_worked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.lazy_timer_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.lazy_timer_projects(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz,
  raw_duration_seconds integer not null default 0,
  counted_duration_seconds integer not null default 0,
  cap_applied boolean not null default false,
  cap_seconds integer,
  note text not null default '',
  is_billed boolean not null default false,
  billed_at timestamptz,
  is_paid boolean not null default false,
  paid_at timestamptz,
  created_offline boolean not null default false,
  manually_adjusted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint lazy_timer_sessions_nonnegative_raw check (raw_duration_seconds >= 0),
  constraint lazy_timer_sessions_nonnegative_counted check (counted_duration_seconds >= 0),
  constraint lazy_timer_sessions_end_after_start check (ended_at is null or ended_at >= started_at),
  constraint lazy_timer_sessions_paid_implies_billed check (is_paid = false or is_billed = true)
);

create table if not exists public.lazy_timer_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  idle_warning_minutes integer not null default 120,
  default_cap_seconds integer not null default 36000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint lazy_timer_settings_one_per_user unique (user_id),
  constraint lazy_timer_settings_idle_positive check (idle_warning_minutes > 0),
  constraint lazy_timer_settings_cap_positive check (default_cap_seconds > 0)
);

create index if not exists lazy_timer_project_types_user_idx on public.lazy_timer_project_types(user_id, deleted_at, is_archived, sort_order);
create index if not exists lazy_timer_projects_user_idx on public.lazy_timer_projects(user_id, deleted_at, is_archived, last_worked_at desc);
create index if not exists lazy_timer_sessions_user_project_idx on public.lazy_timer_sessions(user_id, project_id, deleted_at, started_at desc);
create index if not exists lazy_timer_sessions_running_idx on public.lazy_timer_sessions(user_id, ended_at) where ended_at is null and deleted_at is null;
create index if not exists lazy_timer_sessions_billing_idx on public.lazy_timer_sessions(user_id, is_billed, is_paid, started_at desc) where deleted_at is null;

create or replace function public.lazy_timer_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists lazy_timer_project_types_set_updated_at on public.lazy_timer_project_types;
create trigger lazy_timer_project_types_set_updated_at
before update on public.lazy_timer_project_types
for each row execute function public.lazy_timer_set_updated_at();

drop trigger if exists lazy_timer_projects_set_updated_at on public.lazy_timer_projects;
create trigger lazy_timer_projects_set_updated_at
before update on public.lazy_timer_projects
for each row execute function public.lazy_timer_set_updated_at();

drop trigger if exists lazy_timer_sessions_set_updated_at on public.lazy_timer_sessions;
create trigger lazy_timer_sessions_set_updated_at
before update on public.lazy_timer_sessions
for each row execute function public.lazy_timer_set_updated_at();

drop trigger if exists lazy_timer_settings_set_updated_at on public.lazy_timer_settings;
create trigger lazy_timer_settings_set_updated_at
before update on public.lazy_timer_settings
for each row execute function public.lazy_timer_set_updated_at();

alter table public.lazy_timer_project_types enable row level security;
alter table public.lazy_timer_projects enable row level security;
alter table public.lazy_timer_sessions enable row level security;
alter table public.lazy_timer_settings enable row level security;

-- Project types
create policy "lazy_timer_project_types_select_own"
  on public.lazy_timer_project_types for select
  using (user_id = auth.uid());

create policy "lazy_timer_project_types_insert_own"
  on public.lazy_timer_project_types for insert
  with check (user_id = auth.uid());

create policy "lazy_timer_project_types_update_own"
  on public.lazy_timer_project_types for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "lazy_timer_project_types_delete_own"
  on public.lazy_timer_project_types for delete
  using (user_id = auth.uid());

-- Projects
create policy "lazy_timer_projects_select_own"
  on public.lazy_timer_projects for select
  using (user_id = auth.uid());

create policy "lazy_timer_projects_insert_own"
  on public.lazy_timer_projects for insert
  with check (user_id = auth.uid());

create policy "lazy_timer_projects_update_own"
  on public.lazy_timer_projects for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "lazy_timer_projects_delete_own"
  on public.lazy_timer_projects for delete
  using (user_id = auth.uid());

-- Sessions
create policy "lazy_timer_sessions_select_own"
  on public.lazy_timer_sessions for select
  using (user_id = auth.uid());

create policy "lazy_timer_sessions_insert_own"
  on public.lazy_timer_sessions for insert
  with check (user_id = auth.uid());

create policy "lazy_timer_sessions_update_own"
  on public.lazy_timer_sessions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "lazy_timer_sessions_delete_own"
  on public.lazy_timer_sessions for delete
  using (user_id = auth.uid());

-- Settings
create policy "lazy_timer_settings_select_own"
  on public.lazy_timer_settings for select
  using (user_id = auth.uid());

create policy "lazy_timer_settings_insert_own"
  on public.lazy_timer_settings for insert
  with check (user_id = auth.uid());

create policy "lazy_timer_settings_update_own"
  on public.lazy_timer_settings for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "lazy_timer_settings_delete_own"
  on public.lazy_timer_settings for delete
  using (user_id = auth.uid());
