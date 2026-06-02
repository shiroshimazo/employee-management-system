-- 027_create_payroll_run_approval_rpc.sql
-- Approve reviewed payroll runs.

create or replace function public.approve_payroll_run(
  p_run_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_status text;
  approved_timestamp timestamptz := now();
  payload jsonb;
begin
  if not public.is_payroll() then
    raise exception 'Payroll run approval requires payroll role.'
      using errcode = '42501';
  end if;

  if p_run_id is null then
    raise exception 'Payroll run id is required.'
      using errcode = '22023';
  end if;

  select status
  into current_status
  from public.payroll_runs
  where id = p_run_id
  for update;

  if not found then
    raise exception 'Payroll run not found.'
      using errcode = 'P0002';
  end if;

  if current_status <> 'review' then
    raise exception 'Only payroll runs in review can be approved.'
      using errcode = '22023';
  end if;

  update public.payroll_runs
  set
    status = 'approved',
    approved_by = auth.uid(),
    approved_at = approved_timestamp
  where id = p_run_id;

  insert into public.audit_logs (
    actor_id,
    action,
    target_table,
    target_id,
    meta
  )
  values (
    auth.uid(),
    'payroll_run.approved',
    'payroll_runs',
    p_run_id,
    jsonb_build_object(
      'oldStatus', current_status,
      'newStatus', 'approved',
      'approvedAt', approved_timestamp
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
  where pr.id = p_run_id;

  return payload;
end;
$$;

revoke execute on function public.approve_payroll_run(uuid) from public;
grant execute on function public.approve_payroll_run(uuid) to authenticated;

comment on function public.approve_payroll_run(uuid) is
  'Moves a reviewed payroll run into approved status for callers with profiles.role = payroll and writes an audit log row.';
