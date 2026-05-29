-- 003_create_employees.sql
-- Creates the employees table — the HR record for every staff member.
--
-- Relationship to profiles:
--   profiles  = auth-linked identity (one row per auth.users row)
--   employees = HR record (one row per profile, with employee_number, dept,
--               position, hire_date, status, manager, etc.)
--
-- The employees table becomes the source of truth for HR fields. The
-- duplicate columns on profiles (department/position/hire_date) stay in
-- place for backward compatibility but should be considered deprecated;
-- read from employees going forward.

create table if not exists public.employees (
  id               uuid primary key default gen_random_uuid(),
  -- One employee record per profile. Unique enforces 1:1.
  profile_id       uuid not null unique references public.profiles(id) on delete cascade,
  employee_number  text not null unique,
  department_id    uuid references public.departments(id) on delete set null,
  position         text,
  -- Self-reference for reporting lines. Set null on delete so removing a
  -- manager doesn't orphan their reports.
  manager_id       uuid references public.employees(id) on delete set null,
  employment_type  text not null default 'full_time'
                     check (employment_type in ('full_time','part_time','contract','intern')),
  status           text not null default 'active'
                     check (status in ('active','on_leave','probation','terminated','inactive')),
  hire_date        date,
  termination_date date,
  salary           numeric(12,2),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists employees_profile_id_idx    on public.employees (profile_id);
create index if not exists employees_department_id_idx on public.employees (department_id);
create index if not exists employees_manager_id_idx    on public.employees (manager_id);
create index if not exists employees_status_idx        on public.employees (status);

drop trigger if exists employees_set_updated_at on public.employees;
create trigger employees_set_updated_at
  before update on public.employees
  for each row execute function public.set_updated_at();

alter table public.employees enable row level security;
