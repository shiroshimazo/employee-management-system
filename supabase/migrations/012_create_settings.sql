-- 012_create_settings.sql
-- Organization-wide settings as a single-row table.
-- Paste into Supabase Dashboard -> SQL Editor -> New query -> Run.
--
-- ============================================================================
-- Why a single-row table
-- ============================================================================
-- There is exactly one organization, so there should be exactly one settings
-- row. We enforce that with a boolean primary key pinned to `true`: a boolean
-- column can only hold true/false, and the CHECK forces it to true, so at most
-- one row can ever exist. The app reads/writes that row by id = true.
--
-- ============================================================================
-- Auth model
-- ============================================================================
-- Any authenticated user may READ settings (it's reference data — the app
-- shell may want the org name / timezone). Only admins may UPDATE, via the
-- is_admin() helper from 001_create_profiles.sql. There are no INSERT/DELETE
-- policies: the single row is seeded here and never added to or removed.
--
-- Safe to re-run. Idempotent: the seed uses ON CONFLICT DO NOTHING.

-- ============================================================================
-- Table
-- ============================================================================
create table if not exists public.org_settings (
  id                boolean primary key default true check (id),
  organization_name text not null default 'My Organization',
  support_email     text,
  timezone          text not null default 'UTC',
  updated_at        timestamptz not null default now()
);

-- Reuse the set_updated_at() trigger function defined in 001.
drop trigger if exists org_settings_set_updated_at on public.org_settings;
create trigger org_settings_set_updated_at
  before update on public.org_settings
  for each row execute function public.set_updated_at();

-- Seed the single row. ON CONFLICT keeps this idempotent across re-runs.
insert into public.org_settings (id)
values (true)
on conflict (id) do nothing;

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.org_settings enable row level security;

drop policy if exists org_settings_select_all   on public.org_settings;
drop policy if exists org_settings_update_admin on public.org_settings;

-- Anyone signed in can read the settings row.
create policy org_settings_select_all
  on public.org_settings for select
  to authenticated
  using (true);

-- Only admins can change settings.
create policy org_settings_update_admin
  on public.org_settings for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
