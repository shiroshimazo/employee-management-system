-- 008_profiles_lockdown.sql
-- Hardens profiles against self-promotion.
--
-- 001_create_profiles.sql allows a user to update their own row (so they can
-- change avatar / phone / display name). That policy by itself lets them
-- also flip role / department / position / hire_date — fields that should
-- only ever change at admin or HR's direction.
--
-- We close that gap with a BEFORE UPDATE trigger: if the caller is not
-- admin/HR and they try to change one of the locked columns, we silently
-- reset the column to its prior value. Silent rather than RAISE because
-- legitimate self-update payloads from the UI may include all columns
-- (e.g. an ORM round-trip), and we don't want those to fail.
--
-- The trigger also blocks anyone (including admin/HR) from changing the
-- profile's `id` — that PK is bound to auth.users and must stay immutable.

create or replace function public.profiles_guard_sensitive_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_is_privileged boolean := public.is_admin_or_hr();
begin
  -- id is always immutable.
  new.id := old.id;

  -- created_at is set once at insert time. updated_at is maintained by the
  -- existing set_updated_at() trigger, so we don't need to defend it here.
  new.created_at := old.created_at;

  -- For non-admin/HR callers, snap the sensitive fields back to their
  -- previous values. This is allow-by-default for unrelated columns
  -- (full_name, phone, avatar_url) so legitimate self-edits keep working.
  if not caller_is_privileged then
    new.role        := old.role;
    new.department  := old.department;
    new.position    := old.position;
    new.hire_date   := old.hire_date;
  end if;

  return new;
end;
$$;

-- BEFORE UPDATE — runs after the RLS check but before the row is written,
-- which is exactly the seam we want: the user is allowed to update *some*
-- columns on their row, we just rewrite the disallowed ones back.
drop trigger if exists profiles_guard_sensitive_columns on public.profiles;
create trigger profiles_guard_sensitive_columns
  before update on public.profiles
  for each row execute function public.profiles_guard_sensitive_columns();
