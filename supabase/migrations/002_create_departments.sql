-- 002_create_departments.sql
-- Paste into Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Creates the departments table that employees and managers reference.
-- RLS is enabled but no policies are defined here; policies live in 006_rls_policies.sql.

create table if not exists public.departments (
  id           uuid primary key default gen_random_uuid(),
  name         text not null unique,
  code         text unique,
  description  text,
  -- manager_id points at the profile that runs this department. We allow
  -- null because a department can briefly exist without an assigned manager
  -- (e.g. during a reorg). On delete we set null rather than cascade so
  -- losing a manager doesn't wipe the department.
  manager_id   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists departments_manager_id_idx on public.departments (manager_id);

drop trigger if exists departments_set_updated_at on public.departments;
create trigger departments_set_updated_at
  before update on public.departments
  for each row execute function public.set_updated_at();

-- Lock the table down by default; policies are added in a later migration.
alter table public.departments enable row level security;
