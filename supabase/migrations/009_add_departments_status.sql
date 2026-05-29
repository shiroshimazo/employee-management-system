-- 009_add_departments_status.sql
-- Adds a `status` column to departments so the admin UI can filter and
-- badge departments without needing a hard delete.
--
-- Values:
--   'active'   — visible in default lists, used for new employees
--   'archived' — kept for history; hidden from default lists
--
-- This is purely additive: existing rows get the default 'active', and
-- nothing else needs to change. Indexed for the common filter path.

alter table public.departments
  add column if not exists status text not null default 'active'
    check (status in ('active','archived'));

create index if not exists departments_status_idx on public.departments (status);
