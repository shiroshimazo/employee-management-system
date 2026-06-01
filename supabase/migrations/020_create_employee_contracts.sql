-- 020_create_employee_contracts.sql
-- Employment contracts per employee (HR Compliance panel).
-- Paste into Supabase Dashboard -> SQL Editor -> New query -> Run.
--
-- ============================================================================
-- What this is
-- ============================================================================
-- A record of each employee's employment contract(s) — type, term dates, and
-- status — so HR can track who is on what arrangement and what's expiring. The
-- signed document itself is a URL reference (file_url), matching the app's
-- avatar_url / document.file_url pattern, not an uploaded file.
--
-- ============================================================================
-- Auth model
-- ============================================================================
-- Admin/HR manage contracts (insert/update/delete). An employee may READ their
-- own (employee_id = current_employee_id()) but cannot change them.
--
-- Safe to re-run.

create table if not exists public.employee_contracts (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid not null references public.employees(id) on delete cascade,
  contract_type text not null default 'permanent'
                  check (contract_type in ('permanent','fixed_term','probationary','consultancy')),
  start_date    date,
  end_date      date,
  status        text not null default 'active'
                  check (status in ('active','expired','terminated')),
  file_url      text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists employee_contracts_employee_id_idx on public.employee_contracts (employee_id);
create index if not exists employee_contracts_status_idx       on public.employee_contracts (status);

-- Reuse the set_updated_at() trigger function defined in 001.
drop trigger if exists employee_contracts_set_updated_at on public.employee_contracts;
create trigger employee_contracts_set_updated_at
  before update on public.employee_contracts
  for each row execute function public.set_updated_at();

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.employee_contracts enable row level security;

drop policy if exists employee_contracts_select       on public.employee_contracts;
drop policy if exists employee_contracts_insert_admin on public.employee_contracts;
drop policy if exists employee_contracts_update_admin on public.employee_contracts;
drop policy if exists employee_contracts_delete_admin on public.employee_contracts;

create policy employee_contracts_select
  on public.employee_contracts for select
  to authenticated
  using (
    public.is_admin_or_hr()
    or employee_id = public.current_employee_id()
  );

create policy employee_contracts_insert_admin
  on public.employee_contracts for insert
  to authenticated
  with check (public.is_admin_or_hr());

create policy employee_contracts_update_admin
  on public.employee_contracts for update
  to authenticated
  using (public.is_admin_or_hr())
  with check (public.is_admin_or_hr());

create policy employee_contracts_delete_admin
  on public.employee_contracts for delete
  to authenticated
  using (public.is_admin_or_hr());
