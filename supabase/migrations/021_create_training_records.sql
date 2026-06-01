-- 021_create_training_records.sql
-- Employee training / certification records (HR Compliance panel).
-- Paste into Supabase Dashboard -> SQL Editor -> New query -> Run.
--
-- ============================================================================
-- What this is
-- ============================================================================
-- A log of courses, certifications, and trainings an employee has completed or
-- is working through, with completion + expiry dates so HR can spot what's
-- lapsing. Pairs with Contract Management as the two Compliance surfaces.
--
-- ============================================================================
-- Auth model
-- ============================================================================
-- Admin/HR manage records (insert/update/delete). An employee may READ their
-- own (employee_id = current_employee_id()) but cannot change them.
--
-- Safe to re-run.

create table if not exists public.training_records (
  id             uuid primary key default gen_random_uuid(),
  employee_id    uuid not null references public.employees(id) on delete cascade,
  course         text not null,
  provider       text,
  completed_date date,
  expiry_date    date,
  status         text not null default 'completed'
                   check (status in ('completed','in_progress','expired')),
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists training_records_employee_id_idx on public.training_records (employee_id);
create index if not exists training_records_status_idx       on public.training_records (status);

-- Reuse the set_updated_at() trigger function defined in 001.
drop trigger if exists training_records_set_updated_at on public.training_records;
create trigger training_records_set_updated_at
  before update on public.training_records
  for each row execute function public.set_updated_at();

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.training_records enable row level security;

drop policy if exists training_records_select       on public.training_records;
drop policy if exists training_records_insert_admin on public.training_records;
drop policy if exists training_records_update_admin on public.training_records;
drop policy if exists training_records_delete_admin on public.training_records;

create policy training_records_select
  on public.training_records for select
  to authenticated
  using (
    public.is_admin_or_hr()
    or employee_id = public.current_employee_id()
  );

create policy training_records_insert_admin
  on public.training_records for insert
  to authenticated
  with check (public.is_admin_or_hr());

create policy training_records_update_admin
  on public.training_records for update
  to authenticated
  using (public.is_admin_or_hr())
  with check (public.is_admin_or_hr());

create policy training_records_delete_admin
  on public.training_records for delete
  to authenticated
  using (public.is_admin_or_hr());
