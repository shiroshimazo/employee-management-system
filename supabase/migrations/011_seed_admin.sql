-- 011_seed_admin.sql
-- One-time bootstrap: promote an existing user to admin.
-- Paste into Supabase Dashboard -> SQL Editor -> New query -> Run.
--
-- ============================================================================
-- Why this file exists
-- ============================================================================
-- The browser holds only the Supabase anon key, which cannot create auth
-- users. So there is no "create admin" button in the app. The real flow is:
--
--   1. The person signs up like anyone else — either through the app's
--      /register page, or in Supabase Dashboard -> Authentication -> Users
--      -> "Add user". That fires the on_auth_user_created trigger (001),
--      which inserts their public.profiles row with the default role
--      'employee'.
--   2. You run THIS file to flip that row's role to 'admin'.
--
-- ============================================================================
-- The gotcha this file handles for you
-- ============================================================================
-- 008_profiles_lockdown.sql installs a BEFORE UPDATE trigger
-- (profiles_guard_sensitive_columns) that resets `role` back to its previous
-- value whenever the caller is NOT admin/HR — a guard against self-promotion.
-- In the SQL Editor, auth.uid() is null, so you are treated as unprivileged
-- and a plain `update ... set role = 'admin'` would be SILENTLY reverted.
--
-- We disable that trigger for just this promotion, then re-enable it. Postgres
-- DDL is transactional, so if anything below fails, the disable is rolled back
-- too — the guard can never be left off.
--
-- Safe to re-run. Idempotent: a user already at 'admin' stays 'admin'.

do $$
declare
  -- 👇 CHANGE THIS to the email you signed up with.
  admin_email text := 'admin@example.com';
  target_id   uuid;
begin
  select id
    into target_id
    from auth.users
   where lower(email) = lower(admin_email);

  if target_id is null then
    raise exception
      'No auth user found for "%". Sign up first (via /register or the Supabase dashboard), then re-run this file.',
      admin_email;
  end if;

  -- Lift the self-promotion guard for this bootstrap write only.
  alter table public.profiles disable trigger profiles_guard_sensitive_columns;

  -- Upsert: the signup trigger normally created the row already; the insert
  -- branch is a defensive fallback for users that predate that trigger.
  insert into public.profiles (id, role)
  values (target_id, 'admin')
  on conflict (id) do update set role = 'admin';

  -- Restore the guard.
  alter table public.profiles enable trigger profiles_guard_sensitive_columns;

  raise notice 'Promoted "%" (id %) to admin.', admin_email, target_id;
end
$$;

-- ============================================================================
-- Verify
-- ============================================================================
-- Run this afterwards to confirm the role stuck:
--   select id, full_name, role from public.profiles
--    where id = (select id from auth.users where lower(email) = lower('admin@example.com'));
--
-- ----------------------------------------------------------------------------
-- Alternative: promote by UUID instead of email
-- ----------------------------------------------------------------------------
-- If you'd rather paste a known UUID (e.g. copied from the dashboard), the
-- same guarded pattern is:
--
--   alter table public.profiles disable trigger profiles_guard_sensitive_columns;
--   update public.profiles set role = 'admin' where id = '<that-user-uuid>';
--   alter table public.profiles enable trigger profiles_guard_sensitive_columns;
