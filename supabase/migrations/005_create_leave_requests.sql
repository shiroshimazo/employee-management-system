-- 005_create_leave_requests.sql
-- Leave request queue — employees submit, managers/HR/admin act on them.

create table if not exists public.leave_requests (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid not null references public.employees(id) on delete cascade,
  leave_type    text not null
                  check (leave_type in ('vacation','sick','personal','bereavement','unpaid','maternity','paternity')),
  start_date    date not null,
  end_date      date not null,
  -- Days requested. Stored explicitly because business rules around weekends
  -- and holidays often differ from a naive (end - start) calculation.
  days          numeric(5,2) not null default 1,
  reason        text,
  status        text not null default 'pending'
                  check (status in ('pending','approved','rejected','cancelled')),
  -- Approver is the profile (admin/hr/manager) who acted on the request.
  -- Nullable until acted on; set null on delete so a deleted approver
  -- doesn't take historic decisions with them.
  approved_by   uuid references public.profiles(id) on delete set null,
  decided_at    timestamptz,
  decision_note text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (end_date >= start_date)
);

create index if not exists leave_requests_employee_id_idx on public.leave_requests (employee_id);
create index if not exists leave_requests_status_idx      on public.leave_requests (status);
create index if not exists leave_requests_dates_idx       on public.leave_requests (start_date, end_date);

drop trigger if exists leave_requests_set_updated_at on public.leave_requests;
create trigger leave_requests_set_updated_at
  before update on public.leave_requests
  for each row execute function public.set_updated_at();

alter table public.leave_requests enable row level security;
