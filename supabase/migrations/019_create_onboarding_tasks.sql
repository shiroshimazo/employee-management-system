-- 019_create_onboarding_tasks.sql
-- Per-employee onboarding checklists (HR Recruitment panel).
-- Paste into Supabase Dashboard -> SQL Editor -> New query -> Run.
--
-- ============================================================================
-- What this is
-- ============================================================================
-- A list of onboarding tasks tracked against a specific employee (e.g. "Sign
-- contract", "Set up laptop"), each with a done/not-done state. HR adds and
-- checks them off as a new hire gets set up.
--
-- ============================================================================
-- Auth model
-- ============================================================================
-- Admin/HR manage tasks (insert/update/delete). An employee may READ their own
-- onboarding tasks (employee_id = current_employee_id()), so a new hire can
-- see what's expected — but cannot change them.
--
-- Safe to re-run.

create table if not exists public.onboarding_tasks (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  task        text not null,
  done        boolean not null default false,
  notes       text,
  created_at  timestamptz not null default now()
);

create index if not exists onboarding_tasks_employee_id_idx
  on public.onboarding_tasks (employee_id);

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.onboarding_tasks enable row level security;

drop policy if exists onboarding_tasks_select       on public.onboarding_tasks;
drop policy if exists onboarding_tasks_insert_admin on public.onboarding_tasks;
drop policy if exists onboarding_tasks_update_admin on public.onboarding_tasks;
drop policy if exists onboarding_tasks_delete_admin on public.onboarding_tasks;

-- Admin/HR see all; an employee sees only their own tasks.
create policy onboarding_tasks_select
  on public.onboarding_tasks for select
  to authenticated
  using (
    public.is_admin_or_hr()
    or employee_id = public.current_employee_id()
  );

-- Only admin/HR can add, check off, or remove tasks.
create policy onboarding_tasks_insert_admin
  on public.onboarding_tasks for insert
  to authenticated
  with check (public.is_admin_or_hr());

create policy onboarding_tasks_update_admin
  on public.onboarding_tasks for update
  to authenticated
  using (public.is_admin_or_hr())
  with check (public.is_admin_or_hr());

create policy onboarding_tasks_delete_admin
  on public.onboarding_tasks for delete
  to authenticated
  using (public.is_admin_or_hr());
