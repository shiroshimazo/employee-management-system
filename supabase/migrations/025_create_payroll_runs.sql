-- 025_create_payroll_runs.sql
-- Payroll run cycle storage and RPCs for the PayrollRun workspace.
--
-- The table stays behind RPCs so payroll users can create and list run cycles
-- without receiving broad write access to payroll tables.

create table if not exists public.payroll_runs (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (length(trim(name)) > 0),
  period_start   date not null,
  period_end     date not null,
  status         text not null default 'draft'
                   check (status in ('draft','review','approved','cancelled')),
  employee_count int not null default 0 check (employee_count >= 0),
  salary_total   numeric(12,2) not null default 0 check (salary_total >= 0),
  created_by     uuid references public.profiles(id) on delete set null,
  approved_by    uuid references public.profiles(id) on delete set null,
  approved_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint payroll_runs_period_check check (period_end >= period_start),
  constraint payroll_runs_approval_check check (
    (status = 'approved' and approved_at is not null)
    or (status <> 'approved')
  )
);

create index if not exists payroll_runs_status_idx
  on public.payroll_runs (status);

create index if not exists payroll_runs_period_idx
  on public.payroll_runs (period_start desc, period_end desc);

create index if not exists payroll_runs_created_at_idx
  on public.payroll_runs (created_at desc);

drop trigger if exists payroll_runs_set_updated_at on public.payroll_runs;
create trigger payroll_runs_set_updated_at
  before update on public.payroll_runs
  for each row execute function public.set_updated_at();

alter table public.payroll_runs enable row level security;

create or replace function public.get_payroll_runs(
  p_status text default null,
  p_limit int default 50,
  p_offset int default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  payload jsonb;
  safe_limit int := least(greatest(coalesce(p_limit, 50), 1), 200);
  safe_offset int := greatest(coalesce(p_offset, 0), 0);
begin
  if not public.is_payroll() then
    raise exception 'Payroll runs require payroll role.'
      using errcode = '42501';
  end if;

  with filtered as (
    select
      pr.id,
      pr.name,
      pr.period_start,
      pr.period_end,
      pr.status,
      pr.employee_count,
      pr.salary_total,
      pr.created_at,
      pr.updated_at,
      pr.approved_at,
      pr.created_by,
      pr.approved_by,
      coalesce(nullif(created_profile.full_name, ''), 'Unknown user') as created_by_name,
      coalesce(nullif(approved_profile.full_name, ''), 'Unknown user') as approved_by_name
    from public.payroll_runs pr
    left join public.profiles created_profile on created_profile.id = pr.created_by
    left join public.profiles approved_profile on approved_profile.id = pr.approved_by
    where coalesce(p_status, '') = '' or pr.status = p_status
  ),
  counted as (
    select count(*)::int as total_count
    from filtered
  ),
  paged as (
    select *
    from filtered
    order by created_at desc, period_start desc, name
    limit safe_limit
    offset safe_offset
  ),
  rows as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'name', name,
          'periodStart', period_start,
          'periodEnd', period_end,
          'status', status,
          'employeeCount', employee_count,
          'salaryTotal', salary_total,
          'createdAt', created_at,
          'updatedAt', updated_at,
          'createdBy', jsonb_build_object(
            'id', created_by,
            'name', created_by_name
          ),
          'approvedAt', approved_at,
          'approvedBy', case
            when approved_by is null then null
            else jsonb_build_object(
              'id', approved_by,
              'name', approved_by_name
            )
          end
        )
        order by created_at desc, period_start desc, name
      ),
      '[]'::jsonb
    ) as data
    from paged
  )
  select jsonb_build_object(
    'count', c.total_count,
    'rows', r.data
  )
  into payload
  from counted c
  cross join rows r;

  return payload;
end;
$$;

create or replace function public.create_payroll_run(
  p_period_start date,
  p_period_end date,
  p_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  active_employee_count int;
  active_salary_total numeric(12,2);
  next_name text;
  new_run_id uuid;
  payload jsonb;
begin
  if not public.is_payroll() then
    raise exception 'Payroll run creation requires payroll role.'
      using errcode = '42501';
  end if;

  if p_period_start is null or p_period_end is null then
    raise exception 'Payroll period start and end are required.'
      using errcode = '22023';
  end if;

  if p_period_end < p_period_start then
    raise exception 'Payroll period end must be on or after the start date.'
      using errcode = '22023';
  end if;

  select
    count(*)::int,
    coalesce(sum(salary), 0)::numeric(12,2)
  into active_employee_count, active_salary_total
  from public.employees
  where status not in ('terminated', 'inactive');

  next_name := coalesce(
    nullif(trim(p_name), ''),
    'Payroll ' || to_char(p_period_start, 'Mon DD') || ' - ' || to_char(p_period_end, 'Mon DD, YYYY')
  );

  insert into public.payroll_runs (
    name,
    period_start,
    period_end,
    status,
    employee_count,
    salary_total,
    created_by
  )
  values (
    next_name,
    p_period_start,
    p_period_end,
    'draft',
    active_employee_count,
    active_salary_total,
    auth.uid()
  )
  returning id into new_run_id;

  insert into public.audit_logs (
    actor_id,
    action,
    target_table,
    target_id,
    meta
  )
  values (
    auth.uid(),
    'payroll_run.created',
    'payroll_runs',
    new_run_id,
    jsonb_build_object(
      'periodStart', p_period_start,
      'periodEnd', p_period_end,
      'employeeCount', active_employee_count,
      'salaryTotal', active_salary_total
    )
  );

  select jsonb_build_object(
    'id', pr.id,
    'name', pr.name,
    'periodStart', pr.period_start,
    'periodEnd', pr.period_end,
    'status', pr.status,
    'employeeCount', pr.employee_count,
    'salaryTotal', pr.salary_total,
    'createdAt', pr.created_at,
    'updatedAt', pr.updated_at,
    'createdBy', jsonb_build_object(
      'id', pr.created_by,
      'name', coalesce(nullif(created_profile.full_name, ''), 'Unknown user')
    ),
    'approvedAt', pr.approved_at,
    'approvedBy', case
      when pr.approved_by is null then null
      else jsonb_build_object(
        'id', pr.approved_by,
        'name', coalesce(nullif(approved_profile.full_name, ''), 'Unknown user')
      )
    end
  )
  into payload
  from public.payroll_runs pr
  left join public.profiles created_profile on created_profile.id = pr.created_by
  left join public.profiles approved_profile on approved_profile.id = pr.approved_by
  where pr.id = new_run_id;

  return payload;
end;
$$;

revoke execute on function public.get_payroll_runs(text, int, int) from public;
grant execute on function public.get_payroll_runs(text, int, int) to authenticated;

revoke execute on function public.create_payroll_run(date, date, text) from public;
grant execute on function public.create_payroll_run(date, date, text) to authenticated;

comment on function public.get_payroll_runs(text, int, int) is
  'Returns payroll run cycles for callers with profiles.role = payroll.';

comment on function public.create_payroll_run(date, date, text) is
  'Creates a draft payroll run cycle for callers with profiles.role = payroll and writes an audit log row.';
