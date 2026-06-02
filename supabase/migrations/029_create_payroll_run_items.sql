-- 029_create_payroll_run_items.sql
-- Employee-level payroll run snapshots.
--
-- Existing payroll_runs rows store cycle-level totals. This migration adds
-- immutable line snapshots so each new payroll run preserves the employees and
-- salary values used when the run was created.

create table if not exists public.payroll_run_items (
  id                uuid primary key default gen_random_uuid(),
  payroll_run_id    uuid not null references public.payroll_runs(id) on delete cascade,
  employee_id       uuid references public.employees(id) on delete set null,
  employee_number   text not null,
  employee_name     text not null,
  department_name   text not null default 'Unassigned',
  department_code   text,
  position          text,
  employment_type   text not null,
  status            text not null,
  salary            numeric(12,2) check (salary is null or salary >= 0),
  created_at        timestamptz not null default now(),
  constraint payroll_run_items_employee_unique unique (payroll_run_id, employee_id)
);

create index if not exists payroll_run_items_run_idx
  on public.payroll_run_items (payroll_run_id);

create index if not exists payroll_run_items_employee_idx
  on public.payroll_run_items (employee_id);

create index if not exists payroll_run_items_name_idx
  on public.payroll_run_items (employee_name, employee_number);

alter table public.payroll_run_items enable row level security;

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
  item_count int;
  item_salary_total numeric(12,2);
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
    0,
    0,
    auth.uid()
  )
  returning id into new_run_id;

  insert into public.payroll_run_items (
    payroll_run_id,
    employee_id,
    employee_number,
    employee_name,
    department_name,
    department_code,
    position,
    employment_type,
    status,
    salary
  )
  select
    new_run_id,
    e.id,
    e.employee_number,
    coalesce(nullif(p.full_name, ''), 'Unnamed employee'),
    coalesce(d.name, 'Unassigned'),
    d.code,
    e.position,
    e.employment_type,
    e.status,
    e.salary
  from public.employees e
  left join public.profiles p on p.id = e.profile_id
  left join public.departments d on d.id = e.department_id
  where e.status not in ('terminated', 'inactive');

  select
    count(*)::int,
    coalesce(sum(salary), 0)::numeric(12,2)
  into item_count, item_salary_total
  from public.payroll_run_items
  where payroll_run_id = new_run_id;

  update public.payroll_runs
  set
    employee_count = item_count,
    salary_total = item_salary_total
  where id = new_run_id;

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
      'employeeCount', item_count,
      'salaryTotal', item_salary_total,
      'snapshotItems', item_count
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

create or replace function public.get_payroll_run_details(
  p_run_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  payload jsonb;
begin
  if not public.is_payroll() then
    raise exception 'Payroll run details require payroll role.'
      using errcode = '42501';
  end if;

  if p_run_id is null then
    raise exception 'Payroll run id is required.'
      using errcode = '22023';
  end if;

  perform 1
  from public.payroll_runs
  where id = p_run_id;

  if not found then
    raise exception 'Payroll run not found.'
      using errcode = 'P0002';
  end if;

  with item_rows as (
    select
      pri.id,
      pri.employee_id,
      pri.employee_number,
      pri.employee_name,
      pri.department_name,
      pri.department_code,
      pri.position,
      pri.employment_type,
      pri.status,
      pri.salary,
      pri.created_at
    from public.payroll_run_items pri
    where pri.payroll_run_id = p_run_id
  ),
  item_summary as (
    select
      count(*)::int as item_count,
      count(*) filter (where salary is null)::int as missing_salary_count,
      coalesce(sum(salary), 0)::numeric(12,2) as salary_total,
      coalesce(round(avg(salary), 2), 0)::numeric(12,2) as average_salary
    from item_rows
  ),
  items as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'employeeId', employee_id,
          'employeeNumber', employee_number,
          'name', employee_name,
          'position', position,
          'employmentType', employment_type,
          'status', status,
          'salary', salary,
          'createdAt', created_at,
          'department', jsonb_build_object(
            'name', department_name,
            'code', department_code
          )
        )
        order by employee_name, employee_number
      ),
      '[]'::jsonb
    ) as data
    from item_rows
  )
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
    end,
    'itemSummary', jsonb_build_object(
      'itemCount', s.item_count,
      'missingSalary', s.missing_salary_count,
      'salaryTotal', s.salary_total,
      'averageSalary', s.average_salary
    ),
    'items', i.data
  )
  into payload
  from public.payroll_runs pr
  left join public.profiles created_profile on created_profile.id = pr.created_by
  left join public.profiles approved_profile on approved_profile.id = pr.approved_by
  cross join item_summary s
  cross join items i
  where pr.id = p_run_id;

  return payload;
end;
$$;

revoke execute on function public.create_payroll_run(date, date, text) from public;
grant execute on function public.create_payroll_run(date, date, text) to authenticated;

revoke execute on function public.get_payroll_run_details(uuid) from public;
grant execute on function public.get_payroll_run_details(uuid) to authenticated;

comment on table public.payroll_run_items is
  'Employee-level salary snapshots captured when a payroll run is created.';

comment on function public.get_payroll_run_details(uuid) is
  'Returns a payroll run with employee-level snapshot items for callers with profiles.role = payroll.';
