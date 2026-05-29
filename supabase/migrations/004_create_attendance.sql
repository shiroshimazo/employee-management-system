-- 004_create_attendance.sql
-- Daily attendance ledger — one row per employee per day.

create table if not exists public.attendance (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references public.employees(id) on delete cascade,
  date         date not null,
  check_in     timestamptz,
  check_out    timestamptz,
  status       text not null default 'present'
                 check (status in ('present','absent','late','half_day','leave','remote')),
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- One record per employee per day. Updates (e.g. correcting a late
  -- check-in) happen by upsert on this constraint.
  unique (employee_id, date)
);

create index if not exists attendance_employee_id_idx on public.attendance (employee_id);
create index if not exists attendance_date_idx        on public.attendance (date);
create index if not exists attendance_status_idx      on public.attendance (status);

drop trigger if exists attendance_set_updated_at on public.attendance;
create trigger attendance_set_updated_at
  before update on public.attendance
  for each row execute function public.set_updated_at();

alter table public.attendance enable row level security;
