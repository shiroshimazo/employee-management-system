-- 018_create_applicants.sql
-- Candidates applying to job postings (HR Recruitment panel).
-- Paste into Supabase Dashboard -> SQL Editor -> New query -> Run.
--
-- ============================================================================
-- What this is
-- ============================================================================
-- People who have applied to a role, tracked through a hiring pipeline
-- (applied -> screening -> interview -> offer -> hired/rejected). Each may
-- reference a job_posting (017). Resume is a URL reference, matching the app's
-- avatar_url / document.file_url pattern — not an uploaded file.
--
-- Marking a candidate 'hired' only sets their stage. It does NOT create an
-- employee or auth user (the browser anon key can't mint auth users) — that
-- provisioning stays a separate, server-side concern.
--
-- ============================================================================
-- Auth model
-- ============================================================================
-- Applicants are external candidates, not staff — so unlike the other HR
-- tables there's no all-authenticated read. Only admin/HR may see or manage
-- them, via is_admin_or_hr(), for every operation.
--
-- Safe to re-run.

create table if not exists public.applicants (
  id             uuid primary key default gen_random_uuid(),
  -- The role applied for. Null-safe on delete so removing a posting keeps the
  -- candidate record (just unlinked).
  job_posting_id uuid references public.job_postings(id) on delete set null,
  name           text not null,
  email          text,
  phone          text,
  resume_url     text,
  stage          text not null default 'applied'
                   check (stage in ('applied','screening','interview','offer','hired','rejected')),
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists applicants_job_posting_idx on public.applicants (job_posting_id);
create index if not exists applicants_stage_idx        on public.applicants (stage);

-- Reuse the set_updated_at() trigger function defined in 001.
drop trigger if exists applicants_set_updated_at on public.applicants;
create trigger applicants_set_updated_at
  before update on public.applicants
  for each row execute function public.set_updated_at();

-- ============================================================================
-- Row Level Security — admin/HR only, all operations.
-- ============================================================================
alter table public.applicants enable row level security;

drop policy if exists applicants_select_admin_hr on public.applicants;
drop policy if exists applicants_insert_admin_hr on public.applicants;
drop policy if exists applicants_update_admin_hr on public.applicants;
drop policy if exists applicants_delete_admin_hr on public.applicants;

create policy applicants_select_admin_hr
  on public.applicants for select
  to authenticated
  using (public.is_admin_or_hr());

create policy applicants_insert_admin_hr
  on public.applicants for insert
  to authenticated
  with check (public.is_admin_or_hr());

create policy applicants_update_admin_hr
  on public.applicants for update
  to authenticated
  using (public.is_admin_or_hr())
  with check (public.is_admin_or_hr());

create policy applicants_delete_admin_hr
  on public.applicants for delete
  to authenticated
  using (public.is_admin_or_hr());
