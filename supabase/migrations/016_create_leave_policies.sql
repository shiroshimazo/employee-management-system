-- 016_create_leave_policies.sql
-- Annual leave allowances per leave type (HR Leave Management panel).
-- Paste into Supabase Dashboard -> SQL Editor -> New query -> Run.
--
-- ============================================================================
-- What this is (and what it isn't)
-- ============================================================================
-- One row per leave type with the annual allowance (days/year) HR grants for
-- it. This is the org-level *quota*, the missing half of leave policy — the
-- per-request rules (minimum notice, maximum consecutive days) already live on
-- org_settings (013) and are enforced in leave.service.
--
-- This does NOT track per-employee balances (days remaining per person) — that
-- is a separate feature on top of this. Here we just store the allowance.
--
-- leave_type is the primary key and its CHECK mirrors the leave_requests
-- CHECK in 005 exactly, so the two never drift.
--
-- ============================================================================
-- Auth model
-- ============================================================================
-- All authenticated users may READ the allowances (an employee may want to
-- know their entitlement). Only admin/HR may UPDATE. No INSERT/DELETE policies:
-- the rows are seeded here, one per type, and never added to or removed.
--
-- Safe to re-run. Idempotent: the seed uses ON CONFLICT DO NOTHING.

create table if not exists public.leave_policies (
  leave_type            text primary key
                          check (leave_type in ('vacation','sick','personal','bereavement','unpaid','maternity','paternity')),
  annual_allowance_days numeric(5,1) not null default 0
                          check (annual_allowance_days >= 0),
  description           text,
  updated_at           timestamptz not null default now()
);

-- Reuse the set_updated_at() trigger function defined in 001.
drop trigger if exists leave_policies_set_updated_at on public.leave_policies;
create trigger leave_policies_set_updated_at
  before update on public.leave_policies
  for each row execute function public.set_updated_at();

-- Seed one row per leave type with sensible starting allowances (0 = unset /
-- no fixed allowance, e.g. unpaid). ON CONFLICT keeps re-runs safe.
insert into public.leave_policies (leave_type, annual_allowance_days) values
  ('vacation', 15),
  ('sick', 10),
  ('personal', 5),
  ('bereavement', 3),
  ('unpaid', 0),
  ('maternity', 0),
  ('paternity', 0)
on conflict (leave_type) do nothing;

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.leave_policies enable row level security;

drop policy if exists leave_policies_select_all   on public.leave_policies;
drop policy if exists leave_policies_update_admin_hr on public.leave_policies;

-- Anyone signed in can read the allowances.
create policy leave_policies_select_all
  on public.leave_policies for select
  to authenticated
  using (true);

-- Only admin/HR can change them.
create policy leave_policies_update_admin_hr
  on public.leave_policies for update
  to authenticated
  using (public.is_admin_or_hr())
  with check (public.is_admin_or_hr());
