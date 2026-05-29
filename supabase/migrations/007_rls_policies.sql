-- 007_rls_policies.sql
-- Role helpers + Row Level Security policies for the HR tables.
--
-- Read order:
--   1. Helpers — SECURITY DEFINER functions that policies call to decide
--      "is the current user an admin / HR / a manager of this row?"
--   2. Policies — one drop+create block per (table, action) pair so the
--      whole file is safely re-runnable.
--
-- Conventions:
--   - All helpers are SECURITY DEFINER + search_path=public so they can read
--     profiles/employees without bouncing off the caller's RLS.
--   - Policies prefer USING (...) for SELECT/UPDATE/DELETE visibility and
--     WITH CHECK (...) for INSERT/UPDATE write rules. Both clauses are set
--     on UPDATE so a row can't be moved out of the caller's view.

-- ============================================================================
-- Helpers
-- ============================================================================

-- is_hr(): true iff the calling profile's role is 'hr'.
create or replace function public.is_hr()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'hr'
  );
$$;

-- is_manager(): true iff the calling profile's role is 'manager'.
create or replace function public.is_manager()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'manager'
  );
$$;

-- is_admin_or_hr(): convenience for the "back-office" predicate that shows
-- up in nearly every policy. Avoids re-running two EXISTS checks.
create or replace function public.is_admin_or_hr()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin','hr')
  );
$$;

-- current_employee_id(): the employees.id row that belongs to the caller.
-- Null if the caller has a profile but no employees row yet.
create or replace function public.current_employee_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from public.employees where profile_id = auth.uid();
$$;

-- manages_employee(emp_id): true iff the caller is a manager of that
-- employee, by either of two paths:
--   (a) employees.manager_id points at the caller's own employees row, OR
--   (b) the employee's department has departments.manager_id = auth.uid().
-- Either path is enough — managers may run a department, lead a reporting
-- chain, or both.
create or replace function public.manages_employee(emp_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.employees e
    left join public.departments d on d.id = e.department_id
    where e.id = emp_id
      and (
        e.manager_id = public.current_employee_id()
        or d.manager_id = auth.uid()
      )
  );
$$;

-- ============================================================================
-- departments
-- ============================================================================

drop policy if exists departments_select_all     on public.departments;
drop policy if exists departments_write_admin_hr on public.departments;
drop policy if exists departments_update_admin_hr on public.departments;
drop policy if exists departments_delete_admin_hr on public.departments;

-- Anyone signed in can read departments — needed for dropdowns, filters,
-- and seeing one's own org structure. No PII lives here.
create policy departments_select_all
  on public.departments for select
  to authenticated
  using (true);

-- Only admins/HR can create, update, or delete departments.
create policy departments_write_admin_hr
  on public.departments for insert
  to authenticated
  with check (public.is_admin_or_hr());

create policy departments_update_admin_hr
  on public.departments for update
  to authenticated
  using (public.is_admin_or_hr())
  with check (public.is_admin_or_hr());

create policy departments_delete_admin_hr
  on public.departments for delete
  to authenticated
  using (public.is_admin_or_hr());

-- ============================================================================
-- employees
-- ============================================================================

drop policy if exists employees_select_admin_hr on public.employees;
drop policy if exists employees_select_manager  on public.employees;
drop policy if exists employees_select_self     on public.employees;
drop policy if exists employees_insert_admin_hr on public.employees;
drop policy if exists employees_update_admin_hr on public.employees;
drop policy if exists employees_delete_admin_hr on public.employees;

-- Admin / HR see every employee.
create policy employees_select_admin_hr
  on public.employees for select
  to authenticated
  using (public.is_admin_or_hr());

-- Managers see employees on their team (department or direct report chain).
create policy employees_select_manager
  on public.employees for select
  to authenticated
  using (public.is_manager() and public.manages_employee(id));

-- Every employee can read their own row.
create policy employees_select_self
  on public.employees for select
  to authenticated
  using (profile_id = auth.uid());

-- Only admin/HR may create, update, or delete employee records. Self-service
-- profile fields live on `profiles`, not here.
create policy employees_insert_admin_hr
  on public.employees for insert
  to authenticated
  with check (public.is_admin_or_hr());

create policy employees_update_admin_hr
  on public.employees for update
  to authenticated
  using (public.is_admin_or_hr())
  with check (public.is_admin_or_hr());

create policy employees_delete_admin_hr
  on public.employees for delete
  to authenticated
  using (public.is_admin_or_hr());

-- ============================================================================
-- attendance
-- ============================================================================

drop policy if exists attendance_select_admin_hr on public.attendance;
drop policy if exists attendance_select_manager  on public.attendance;
drop policy if exists attendance_select_self     on public.attendance;
drop policy if exists attendance_insert_admin_hr on public.attendance;
drop policy if exists attendance_insert_self     on public.attendance;
drop policy if exists attendance_update_admin_hr on public.attendance;
drop policy if exists attendance_update_self     on public.attendance;
drop policy if exists attendance_delete_admin_hr on public.attendance;

-- Read paths mirror employees: admin/HR see all, managers see their team,
-- employees see their own punches.
create policy attendance_select_admin_hr
  on public.attendance for select
  to authenticated
  using (public.is_admin_or_hr());

create policy attendance_select_manager
  on public.attendance for select
  to authenticated
  using (public.is_manager() and public.manages_employee(employee_id));

create policy attendance_select_self
  on public.attendance for select
  to authenticated
  using (employee_id = public.current_employee_id());

-- Admin/HR can insert/update for anyone; an employee can punch in/out for
-- themselves. Employees cannot delete their own attendance — corrections
-- need to go through HR for the audit trail.
create policy attendance_insert_admin_hr
  on public.attendance for insert
  to authenticated
  with check (public.is_admin_or_hr());

create policy attendance_insert_self
  on public.attendance for insert
  to authenticated
  with check (employee_id = public.current_employee_id());

create policy attendance_update_admin_hr
  on public.attendance for update
  to authenticated
  using (public.is_admin_or_hr())
  with check (public.is_admin_or_hr());

create policy attendance_update_self
  on public.attendance for update
  to authenticated
  using (employee_id = public.current_employee_id())
  with check (employee_id = public.current_employee_id());

create policy attendance_delete_admin_hr
  on public.attendance for delete
  to authenticated
  using (public.is_admin_or_hr());

-- ============================================================================
-- leave_requests
-- ============================================================================

drop policy if exists leave_requests_select_admin_hr on public.leave_requests;
drop policy if exists leave_requests_select_manager  on public.leave_requests;
drop policy if exists leave_requests_select_self     on public.leave_requests;
drop policy if exists leave_requests_insert_self     on public.leave_requests;
drop policy if exists leave_requests_insert_admin_hr on public.leave_requests;
drop policy if exists leave_requests_update_admin_hr on public.leave_requests;
drop policy if exists leave_requests_update_manager  on public.leave_requests;
drop policy if exists leave_requests_update_self     on public.leave_requests;
drop policy if exists leave_requests_delete_admin_hr on public.leave_requests;

create policy leave_requests_select_admin_hr
  on public.leave_requests for select
  to authenticated
  using (public.is_admin_or_hr());

create policy leave_requests_select_manager
  on public.leave_requests for select
  to authenticated
  using (public.is_manager() and public.manages_employee(employee_id));

create policy leave_requests_select_self
  on public.leave_requests for select
  to authenticated
  using (employee_id = public.current_employee_id());

-- Employees submit their own requests. Admin/HR may submit on behalf of
-- anyone (e.g. recording a phoned-in sick day).
create policy leave_requests_insert_self
  on public.leave_requests for insert
  to authenticated
  with check (
    employee_id = public.current_employee_id()
    and status = 'pending'
  );

create policy leave_requests_insert_admin_hr
  on public.leave_requests for insert
  to authenticated
  with check (public.is_admin_or_hr());

-- Approve/reject paths:
--   - admin/HR can update any request
--   - a manager can decide on requests from their own team
--   - an employee can update their own request only while it's still pending
--     (e.g. cancel it). They cannot flip a decided request.
create policy leave_requests_update_admin_hr
  on public.leave_requests for update
  to authenticated
  using (public.is_admin_or_hr())
  with check (public.is_admin_or_hr());

create policy leave_requests_update_manager
  on public.leave_requests for update
  to authenticated
  using (public.is_manager() and public.manages_employee(employee_id))
  with check (public.is_manager() and public.manages_employee(employee_id));

create policy leave_requests_update_self
  on public.leave_requests for update
  to authenticated
  using (
    employee_id = public.current_employee_id()
    and status = 'pending'
  )
  with check (
    employee_id = public.current_employee_id()
    and status in ('pending','cancelled')
  );

create policy leave_requests_delete_admin_hr
  on public.leave_requests for delete
  to authenticated
  using (public.is_admin_or_hr());

-- ============================================================================
-- audit_logs
-- ============================================================================

drop policy if exists audit_logs_select_admin_hr on public.audit_logs;
drop policy if exists audit_logs_insert_self     on public.audit_logs;
drop policy if exists audit_logs_insert_admin_hr on public.audit_logs;

-- Read access is back-office only.
create policy audit_logs_select_admin_hr
  on public.audit_logs for select
  to authenticated
  using (public.is_admin_or_hr());

-- Anyone authenticated can write a row that records *their own* action.
-- This lets the client log low-risk events (e.g. login, viewed_report) while
-- keeping the actor honest. Privileged events should still go through a
-- SECURITY DEFINER helper.
create policy audit_logs_insert_self
  on public.audit_logs for insert
  to authenticated
  with check (actor_id = auth.uid());

-- Admin/HR can backfill audit rows on behalf of others (e.g. system jobs
-- attributed to a generic actor or null).
create policy audit_logs_insert_admin_hr
  on public.audit_logs for insert
  to authenticated
  with check (public.is_admin_or_hr());

-- No UPDATE / DELETE policies are defined for audit_logs. With RLS enabled
-- and no policies, those actions are denied for non-superusers — exactly
-- what an append-only audit trail wants.
