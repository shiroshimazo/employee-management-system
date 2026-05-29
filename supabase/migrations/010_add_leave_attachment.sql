-- 010_add_leave_attachment.sql
-- Adds an optional attachment URL to leave_requests.
--
-- The leave-request form lets an employee attach supporting documentation
-- (doctor's note, travel confirmation, etc.). We store a URL string here
-- rather than a bytea blob — the actual file lives in Supabase Storage.
--
-- This is purely additive: existing rows get null and nothing else changes.

alter table public.leave_requests
  add column if not exists attachment_url text;
