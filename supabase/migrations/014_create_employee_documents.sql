-- 014_create_employee_documents.sql
-- HR document records attached to employees (Employee Records panel).
-- Paste into Supabase Dashboard -> SQL Editor -> New query -> Run.
--
-- ============================================================================
-- Why URL references, not file uploads
-- ============================================================================
-- This app's established pattern is to store a link, not the bytes:
-- profiles.avatar_url and leave_requests.attachment_url are both URL columns.
-- We follow that here — `file_url` points at the document wherever it lives.
-- Real file upload would need Supabase Storage + a bucket policy; that's a
-- clean later enhancement that can reuse this same table.
--
-- ============================================================================
-- Auth model (mirrors the other HR tables in 007)
-- ============================================================================
-- Admin/HR manage all documents. An employee may READ their own documents
-- (employee_id = current_employee_id()), but cannot add or remove them —
-- those stay with HR for the record's integrity. No UPDATE policy: a document
-- record is created and deleted, not edited in place.
--
-- Safe to re-run.

create table if not exists public.employee_documents (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  title       text not null,
  doc_type    text not null default 'other'
                check (doc_type in ('contract','identification','certification','review','other')),
  file_url    text,
  notes       text,
  -- Who filed it. Null-safe on delete so removing a user keeps the record.
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists employee_documents_employee_id_idx
  on public.employee_documents (employee_id);
create index if not exists employee_documents_created_at_idx
  on public.employee_documents (created_at desc);

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.employee_documents enable row level security;

drop policy if exists employee_documents_select       on public.employee_documents;
drop policy if exists employee_documents_insert_admin on public.employee_documents;
drop policy if exists employee_documents_delete_admin on public.employee_documents;

-- Admin/HR see everything; an employee sees only their own documents.
create policy employee_documents_select
  on public.employee_documents for select
  to authenticated
  using (
    public.is_admin_or_hr()
    or employee_id = public.current_employee_id()
  );

-- Only admin/HR can file or remove documents.
create policy employee_documents_insert_admin
  on public.employee_documents for insert
  to authenticated
  with check (public.is_admin_or_hr());

create policy employee_documents_delete_admin
  on public.employee_documents for delete
  to authenticated
  using (public.is_admin_or_hr());
