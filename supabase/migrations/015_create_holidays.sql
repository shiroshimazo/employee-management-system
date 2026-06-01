-- 015_create_holidays.sql
-- Company holiday calendar (HR Leave Management panel).
-- Paste into Supabase Dashboard -> SQL Editor -> New query -> Run.
--
-- ============================================================================
-- What this is
-- ============================================================================
-- A simple list of company-observed holidays (name + date). HR maintains it;
-- everyone can read it so the org knows the non-working dates. This is a
-- standalone reference table — it does not (yet) feed attendance's working-day
-- logic; wiring that is a clean later enhancement.
--
-- ============================================================================
-- Auth model (mirrors the other reference tables in 007)
-- ============================================================================
-- All authenticated users may READ holidays. Only admin/HR may add or remove
-- them via is_admin_or_hr(). No UPDATE policy: a holiday is added or deleted,
-- not edited in place.
--
-- Safe to re-run.

create table if not exists public.holidays (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  holiday_date date not null,
  notes        text,
  created_at   timestamptz not null default now()
);

create index if not exists holidays_date_idx on public.holidays (holiday_date);

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.holidays enable row level security;

drop policy if exists holidays_select_all      on public.holidays;
drop policy if exists holidays_insert_admin_hr on public.holidays;
drop policy if exists holidays_delete_admin_hr on public.holidays;

-- Anyone signed in can read the calendar.
create policy holidays_select_all
  on public.holidays for select
  to authenticated
  using (true);

-- Only admin/HR can add or remove holidays.
create policy holidays_insert_admin_hr
  on public.holidays for insert
  to authenticated
  with check (public.is_admin_or_hr());

create policy holidays_delete_admin_hr
  on public.holidays for delete
  to authenticated
  using (public.is_admin_or_hr());
