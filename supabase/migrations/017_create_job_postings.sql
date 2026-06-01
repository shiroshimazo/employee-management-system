-- 017_create_job_postings.sql
-- Job postings for the HR Recruitment panel.
-- Paste into Supabase Dashboard -> SQL Editor -> New query -> Run.
--
-- ============================================================================
-- What this is
-- ============================================================================
-- Open roles the company is hiring for. HR maintains them; everyone signed in
-- can read (so the org can see what's open). Applicants (018) reference a
-- posting. This is HR-internal — there's no public/careers-facing form here.
--
-- ============================================================================
-- Auth model (mirrors the reference tables in 007)
-- ============================================================================
-- All authenticated users may READ postings. Only admin/HR may create, update,
-- or delete them via is_admin_or_hr().
--
-- Safe to re-run.

create table if not exists public.job_postings (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  -- Owning department. Null-safe on delete so removing a department doesn't
  -- take its postings with it.
  department_id   uuid references public.departments(id) on delete set null,
  location        text,
  employment_type text not null default 'full_time'
                    check (employment_type in ('full_time','part_time','contract','intern')),
  description     text,
  status          text not null default 'open'
                    check (status in ('open','closed','draft')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists job_postings_status_idx     on public.job_postings (status);
create index if not exists job_postings_department_idx on public.job_postings (department_id);

-- Reuse the set_updated_at() trigger function defined in 001.
drop trigger if exists job_postings_set_updated_at on public.job_postings;
create trigger job_postings_set_updated_at
  before update on public.job_postings
  for each row execute function public.set_updated_at();

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.job_postings enable row level security;

drop policy if exists job_postings_select_all      on public.job_postings;
drop policy if exists job_postings_insert_admin_hr on public.job_postings;
drop policy if exists job_postings_update_admin_hr on public.job_postings;
drop policy if exists job_postings_delete_admin_hr on public.job_postings;

create policy job_postings_select_all
  on public.job_postings for select
  to authenticated
  using (true);

create policy job_postings_insert_admin_hr
  on public.job_postings for insert
  to authenticated
  with check (public.is_admin_or_hr());

create policy job_postings_update_admin_hr
  on public.job_postings for update
  to authenticated
  using (public.is_admin_or_hr())
  with check (public.is_admin_or_hr());

create policy job_postings_delete_admin_hr
  on public.job_postings for delete
  to authenticated
  using (public.is_admin_or_hr());
