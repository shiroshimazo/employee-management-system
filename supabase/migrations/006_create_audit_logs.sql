-- 006_create_audit_logs.sql
-- Append-only audit trail for sensitive actions (employee CRUD, role changes,
-- leave decisions, payroll runs, etc.).
--
-- The application writes to this table; nothing should ever update or delete
-- a row. RLS is set up in 007_rls_policies.sql to enforce that — admins and HR
-- can read, only the service role / SECURITY DEFINER paths can insert.

create table if not exists public.audit_logs (
  id           uuid primary key default gen_random_uuid(),
  -- The profile that performed the action. Nullable so system / cron jobs
  -- can be recorded without a user. Set null on delete so removing a user
  -- preserves historical audit rows.
  actor_id     uuid references public.profiles(id) on delete set null,
  -- Free-form action verb, e.g. 'employee.created', 'leave.approved',
  -- 'profile.role_changed'. We keep this loose so feature teams don't
  -- have to ship a migration for every new audit event.
  action       text not null,
  -- target_table + target_id describe the object the action was on. Both
  -- nullable to support actions that aren't row-scoped (e.g. 'login').
  target_table text,
  target_id    uuid,
  meta         jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists audit_logs_actor_id_idx     on public.audit_logs (actor_id);
create index if not exists audit_logs_action_idx       on public.audit_logs (action);
create index if not exists audit_logs_target_idx       on public.audit_logs (target_table, target_id);
create index if not exists audit_logs_created_at_idx   on public.audit_logs (created_at desc);

alter table public.audit_logs enable row level security;
