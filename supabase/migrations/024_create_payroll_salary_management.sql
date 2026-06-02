-- 024_create_payroll_salary_management.sql
-- Salary-management RPCs for the Payroll Compensation workspace.
--
-- These functions keep payroll compensation access narrow: payroll users can
-- list the salary fields needed by the UI and update only employees.salary.

create or replace function public.get_payroll_salary_records(
  p_query text default '',
  p_status text default null,
  p_department_id uuid default null,
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
  search_term text := '%' || trim(coalesce(p_query, '')) || '%';
begin
  if not public.is_payroll() then
    raise exception 'Payroll salary records require payroll role.'
      using errcode = '42501';
  end if;

  with filtered as (
    select
      e.id,
      e.employee_number,
      e.position,
      e.employment_type,
      e.status,
      e.hire_date,
      e.salary,
      e.updated_at,
      coalesce(nullif(p.full_name, ''), 'Unnamed employee') as full_name,
      d.id as department_id,
      coalesce(d.name, 'Unassigned') as department_name,
      d.code as department_code
    from public.employees e
    left join public.profiles p on p.id = e.profile_id
    left join public.departments d on d.id = e.department_id
    where (
        trim(coalesce(p_query, '')) = ''
        or e.employee_number ilike search_term
        or e.position ilike search_term
        or p.full_name ilike search_term
        or d.name ilike search_term
      )
      and (coalesce(p_status, '') = '' or e.status = p_status)
      and (p_department_id is null or e.department_id = p_department_id)
  ),
  kpis as (
    select
      count(*)::int as total_employees,
      count(*) filter (where salary is not null)::int as salaried_employees,
      count(*) filter (where salary is null)::int as missing_salary,
      coalesce(sum(salary), 0)::numeric(12,2) as salary_total,
      coalesce(round(avg(salary), 2), 0)::numeric(12,2) as average_salary
    from filtered
  ),
  paged as (
    select *
    from filtered
    order by full_name, employee_number
    limit safe_limit
    offset safe_offset
  ),
  rows as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'employeeNumber', employee_number,
          'name', full_name,
          'position', position,
          'employmentType', employment_type,
          'status', status,
          'hireDate', hire_date,
          'salary', salary,
          'updatedAt', updated_at,
          'department', jsonb_build_object(
            'id', department_id,
            'name', department_name,
            'code', department_code
          )
        )
        order by full_name, employee_number
      ),
      '[]'::jsonb
    ) as data
    from paged
  )
  select jsonb_build_object(
    'count', k.total_employees,
    'kpis', jsonb_build_object(
      'totalEmployees', k.total_employees,
      'salariedEmployees', k.salaried_employees,
      'missingSalary', k.missing_salary,
      'salaryTotal', k.salary_total,
      'averageSalary', k.average_salary
    ),
    'rows', r.data
  )
  into payload
  from kpis k
  cross join rows r;

  return payload;
end;
$$;

create or replace function public.update_payroll_employee_salary(
  p_employee_id uuid,
  p_salary numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  old_salary numeric;
  payload jsonb;
begin
  if not public.is_payroll() then
    raise exception 'Payroll salary updates require payroll role.'
      using errcode = '42501';
  end if;

  if p_employee_id is null then
    raise exception 'Employee id is required.'
      using errcode = '22023';
  end if;

  if p_salary is not null and p_salary < 0 then
    raise exception 'Salary must be non-negative.'
      using errcode = '22023';
  end if;

  select salary
  into old_salary
  from public.employees
  where id = p_employee_id
  for update;

  if not found then
    raise exception 'Employee not found.'
      using errcode = 'P0002';
  end if;

  update public.employees
  set salary = case
      when p_salary is null then null
      else round(p_salary, 2)
    end
  where id = p_employee_id;

  insert into public.audit_logs (
    actor_id,
    action,
    target_table,
    target_id,
    meta
  )
  values (
    auth.uid(),
    'payroll.salary_updated',
    'employees',
    p_employee_id,
    jsonb_build_object(
      'oldSalary', old_salary,
      'newSalary', case when p_salary is null then null else round(p_salary, 2) end
    )
  );

  select jsonb_build_object(
    'id', e.id,
    'employeeNumber', e.employee_number,
    'name', coalesce(nullif(p.full_name, ''), 'Unnamed employee'),
    'position', e.position,
    'employmentType', e.employment_type,
    'status', e.status,
    'hireDate', e.hire_date,
    'salary', e.salary,
    'updatedAt', e.updated_at,
    'department', jsonb_build_object(
      'id', d.id,
      'name', coalesce(d.name, 'Unassigned'),
      'code', d.code
    )
  )
  into payload
  from public.employees e
  left join public.profiles p on p.id = e.profile_id
  left join public.departments d on d.id = e.department_id
  where e.id = p_employee_id;

  return payload;
end;
$$;

revoke execute on function public.get_payroll_salary_records(text, text, uuid, int, int) from public;
grant execute on function public.get_payroll_salary_records(text, text, uuid, int, int) to authenticated;

revoke execute on function public.update_payroll_employee_salary(uuid, numeric) from public;
grant execute on function public.update_payroll_employee_salary(uuid, numeric) to authenticated;

comment on function public.get_payroll_salary_records(text, text, uuid, int, int) is
  'Returns filtered salary-management records for callers with profiles.role = payroll.';

comment on function public.update_payroll_employee_salary(uuid, numeric) is
  'Updates employees.salary for callers with profiles.role = payroll and writes an audit log row.';
