-- 023_create_payroll_dashboard_metrics.sql
-- Payroll dashboard data for the payroll workspace.
--
-- The browser should not need broad employees-table access just to render the
-- payroll home page. This RPC enforces the payroll role and returns a compact
-- aggregate payload over active employee salary data.

create or replace function public.is_payroll()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid() and role = 'payroll'
  );
$$;

create or replace function public.get_payroll_dashboard_metrics()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  payload jsonb;
begin
  if not public.is_payroll() then
    raise exception 'Payroll dashboard metrics require payroll role.'
      using errcode = '42501';
  end if;

  with active_employees as (
    select
      e.id,
      e.employee_number,
      e.status,
      e.salary,
      coalesce(nullif(p.full_name, ''), 'Unnamed employee') as full_name,
      coalesce(d.name, 'Unassigned') as department,
      d.code
    from public.employees e
    left join public.profiles p on p.id = e.profile_id
    left join public.departments d on d.id = e.department_id
    where e.status not in ('terminated', 'inactive')
  ),
  kpis as (
    select
      count(*)::int as active_payroll,
      count(*) filter (where salary is not null)::int as salaried_employees,
      count(*) filter (where salary is null)::int as missing_salary,
      coalesce(sum(salary), 0)::numeric(12,2) as salary_total,
      coalesce(round(avg(salary), 2), 0)::numeric(12,2) as average_salary
    from active_employees
  ),
  department_costs as (
    select coalesce(jsonb_agg(row_payload order by salary_total desc, department), '[]'::jsonb) as rows
    from (
      select
        department,
        code,
        coalesce(sum(salary), 0)::numeric(12,2) as salary_total,
        coalesce(round(avg(salary), 2), 0)::numeric(12,2) as average_salary,
        count(*)::int as employees,
        jsonb_build_object(
          'department', department,
          'code', code,
          'employees', count(*)::int,
          'salaryTotal', coalesce(sum(salary), 0)::numeric(12,2),
          'averageSalary', coalesce(round(avg(salary), 2), 0)::numeric(12,2)
        ) as row_payload
      from active_employees
      group by department, code
      order by salary_total desc, department
      limit 8
    ) ranked_departments
  ),
  status_breakdown as (
    select coalesce(jsonb_agg(row_payload order by employees desc, status), '[]'::jsonb) as rows
    from (
      select
        status,
        count(*)::int as employees,
        coalesce(sum(salary), 0)::numeric(12,2) as salary_total,
        jsonb_build_object(
          'status', status,
          'employees', count(*)::int,
          'salaryTotal', coalesce(sum(salary), 0)::numeric(12,2)
        ) as row_payload
      from active_employees
      group by status
    ) ranked_statuses
  ),
  missing_salaries as (
    select coalesce(jsonb_agg(row_payload order by full_name, employee_number), '[]'::jsonb) as rows
    from (
      select
        id,
        employee_number,
        full_name,
        department,
        status,
        jsonb_build_object(
          'id', id,
          'employeeNumber', employee_number,
          'name', full_name,
          'department', department,
          'status', status
        ) as row_payload
      from active_employees
      where salary is null
      order by full_name, employee_number
      limit 6
    ) missing
  )
  select jsonb_build_object(
    'generatedAt', now(),
    'kpis', jsonb_build_object(
      'activePayroll', k.active_payroll,
      'salariedEmployees', k.salaried_employees,
      'salaryTotal', k.salary_total,
      'averageSalary', k.average_salary,
      'missingSalary', k.missing_salary
    ),
    'departmentCosts', dc.rows,
    'statusBreakdown', sb.rows,
    'attention', jsonb_build_object(
      'missingSalaries', ms.rows
    )
  )
  into payload
  from kpis k
  cross join department_costs dc
  cross join status_breakdown sb
  cross join missing_salaries ms;

  return payload;
end;
$$;

revoke execute on function public.is_payroll() from public;
grant execute on function public.is_payroll() to authenticated;

revoke execute on function public.get_payroll_dashboard_metrics() from public;
grant execute on function public.get_payroll_dashboard_metrics() to authenticated;

comment on function public.get_payroll_dashboard_metrics() is
  'Returns payroll dashboard aggregate metrics for callers with profiles.role = payroll.';
