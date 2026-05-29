-- 001_create_profiles.sql
-- Paste into Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Creates a profiles table keyed to auth.users, an auto-insert trigger on signup,
-- an is_admin() helper, and RLS policies.

-- ============================================================================
-- Table
-- ============================================================================
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text,
  role          text not null default 'employee'
                  check (role in ('admin','manager','hr','payroll','employee')),
  department    text,
  position      text,
  phone         text,
  hire_date     date,
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ============================================================================
-- updated_at maintenance
-- ============================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ============================================================================
-- Auto-create a profile row when a new auth user is created.
-- Reads full_name from raw_user_meta_data, which the signUp() call populates.
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- is_admin() — SECURITY DEFINER so RLS policies can call it without recursing.
-- ============================================================================
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.profiles enable row level security;

drop policy if exists profiles_select_own   on public.profiles;
drop policy if exists profiles_select_admin on public.profiles;
drop policy if exists profiles_update_own   on public.profiles;
drop policy if exists profiles_update_admin on public.profiles;
drop policy if exists profiles_insert_admin on public.profiles;

-- Users can read their own profile.
create policy profiles_select_own
  on public.profiles for select
  using (auth.uid() = id);

-- Admins can read every profile.
create policy profiles_select_admin
  on public.profiles for select
  using (public.is_admin());

-- Users can update their own profile.
-- NOTE: this currently allows a user to change their own role/department/etc.
-- The UI should not expose those fields on self-edit forms. When building
-- self-edit forms, lock these columns down with a BEFORE UPDATE trigger that
-- resets them to OLD values when the caller is not an admin.
create policy profiles_update_own
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Admins can update any profile.
create policy profiles_update_admin
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

-- Admins can insert profiles directly (e.g. seeding). Normal signups go through
-- the on_auth_user_created trigger, which runs as SECURITY DEFINER and bypasses RLS.
create policy profiles_insert_admin
  on public.profiles for insert
  with check (public.is_admin());

-- ============================================================================
-- Manual bootstrap reminder
-- ============================================================================
-- After your first user signs up, promote them with:
--   update public.profiles set role = 'admin' where id = '<that-user-uuid>';
