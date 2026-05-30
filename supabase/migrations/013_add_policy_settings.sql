-- 013_add_policy_settings.sql
-- Adds attendance + leave policy columns to the org_settings singleton.
-- Paste into Supabase Dashboard -> SQL Editor -> New query -> Run.
--
-- ============================================================================
-- Why these live on org_settings
-- ============================================================================
-- attendance.service.js currently hardcodes the late cut-off (09:00) and the
-- half-day threshold (4h); leave.service.js has no notice/length guardrails.
-- Lifting them to the single settings row lets an admin tune them, and the
-- services read the row with a hardcoded fallback so nothing breaks before or
-- without this migration.
--
-- working_days uses JS getDay() numbering: 0=Sunday … 6=Saturday. Default is
-- Mon–Fri ({1,2,3,4,5}). It drives the dashboard's "absent" derivation so a
-- weekend no longer reads as everyone-absent.
--
-- leave_*_days of 0 means "no restriction" (the pre-migration behavior).
--
-- Purely additive + idempotent: existing rows get the defaults, re-runs are
-- safe. Inherits the RLS policies already on org_settings (all read, admin
-- update) — no new policies needed.

alter table public.org_settings
  add column if not exists late_cutoff text not null default '09:00'
    check (late_cutoff ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

alter table public.org_settings
  add column if not exists half_day_hours numeric not null default 4
    check (half_day_hours > 0);

alter table public.org_settings
  add column if not exists working_days int[] not null default '{1,2,3,4,5}';

alter table public.org_settings
  add column if not exists leave_min_notice_days int not null default 0
    check (leave_min_notice_days >= 0);

alter table public.org_settings
  add column if not exists leave_max_consecutive_days int not null default 0
    check (leave_max_consecutive_days >= 0);
