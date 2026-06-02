-- 026_create_payroll_run_review_rpc.sql
-- Submit draft payroll runs into the review stage.

create or replace function public.submit_payroll_run_for_review(
  p_run_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_status text;
  payload jsonb;
begin
  if not public.is_payroll() then
    raise exception 'Payroll run review requires payroll role.'
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

  if current_status <> 'draft' then
    raise exception 'Only draft payroll runs can be submitted for review.'
      using errcode = '22023';
  end if;

  update public.payroll_runs
  set status = 'review'
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
    'payroll_run.submitted_for_review',
    'payroll_runs',
    p_run_id,
    jsonb_build_object(
      'oldStatus', current_status,
      'newStatus', 'review'
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

revoke execute on function public.submit_payroll_run_for_review(uuid) from public;
grant execute on function public.submit_payroll_run_for_review(uuid) to authenticated;

comment on function public.submit_payroll_run_for_review(uuid) is
  'Moves a draft payroll run into review for callers with profiles.role = payroll and writes an audit log row.';
