-- 022_restrict_hr_module_to_hr.sql
-- Tighten HR-module data policies so the Admin role does not automatically get
-- access to HR-only workflows. Core operational tables used by /admin pages
-- (employees, departments, attendance, leave_requests, audit_logs) keep their
-- existing admin/HR policies.

-- ============================================================================
-- employee_documents
-- ============================================================================
drop policy if exists employee_documents_select       on public.employee_documents;
drop policy if exists employee_documents_insert_admin on public.employee_documents;
drop policy if exists employee_documents_insert_hr    on public.employee_documents;
drop policy if exists employee_documents_delete_admin on public.employee_documents;
drop policy if exists employee_documents_delete_hr    on public.employee_documents;

create policy employee_documents_select
  on public.employee_documents for select
  to authenticated
  using (
    public.is_hr()
    or employee_id = public.current_employee_id()
  );

create policy employee_documents_insert_hr
  on public.employee_documents for insert
  to authenticated
  with check (public.is_hr());

create policy employee_documents_delete_hr
  on public.employee_documents for delete
  to authenticated
  using (public.is_hr());

-- ============================================================================
-- holidays
-- ============================================================================
drop policy if exists holidays_insert_admin_hr on public.holidays;
drop policy if exists holidays_insert_hr       on public.holidays;
drop policy if exists holidays_delete_admin_hr on public.holidays;
drop policy if exists holidays_delete_hr       on public.holidays;

create policy holidays_insert_hr
  on public.holidays for insert
  to authenticated
  with check (public.is_hr());

create policy holidays_delete_hr
  on public.holidays for delete
  to authenticated
  using (public.is_hr());

-- ============================================================================
-- leave_policies
-- ============================================================================
drop policy if exists leave_policies_update_admin_hr on public.leave_policies;
drop policy if exists leave_policies_update_hr       on public.leave_policies;

create policy leave_policies_update_hr
  on public.leave_policies for update
  to authenticated
  using (public.is_hr())
  with check (public.is_hr());

-- ============================================================================
-- job_postings
-- ============================================================================
drop policy if exists job_postings_insert_admin_hr on public.job_postings;
drop policy if exists job_postings_insert_hr       on public.job_postings;
drop policy if exists job_postings_update_admin_hr on public.job_postings;
drop policy if exists job_postings_update_hr       on public.job_postings;
drop policy if exists job_postings_delete_admin_hr on public.job_postings;
drop policy if exists job_postings_delete_hr       on public.job_postings;

create policy job_postings_insert_hr
  on public.job_postings for insert
  to authenticated
  with check (public.is_hr());

create policy job_postings_update_hr
  on public.job_postings for update
  to authenticated
  using (public.is_hr())
  with check (public.is_hr());

create policy job_postings_delete_hr
  on public.job_postings for delete
  to authenticated
  using (public.is_hr());

-- ============================================================================
-- applicants
-- ============================================================================
drop policy if exists applicants_select_admin_hr on public.applicants;
drop policy if exists applicants_select_hr       on public.applicants;
drop policy if exists applicants_insert_admin_hr on public.applicants;
drop policy if exists applicants_insert_hr       on public.applicants;
drop policy if exists applicants_update_admin_hr on public.applicants;
drop policy if exists applicants_update_hr       on public.applicants;
drop policy if exists applicants_delete_admin_hr on public.applicants;
drop policy if exists applicants_delete_hr       on public.applicants;

create policy applicants_select_hr
  on public.applicants for select
  to authenticated
  using (public.is_hr());

create policy applicants_insert_hr
  on public.applicants for insert
  to authenticated
  with check (public.is_hr());

create policy applicants_update_hr
  on public.applicants for update
  to authenticated
  using (public.is_hr())
  with check (public.is_hr());

create policy applicants_delete_hr
  on public.applicants for delete
  to authenticated
  using (public.is_hr());

-- ============================================================================
-- onboarding_tasks
-- ============================================================================
drop policy if exists onboarding_tasks_select       on public.onboarding_tasks;
drop policy if exists onboarding_tasks_insert_admin on public.onboarding_tasks;
drop policy if exists onboarding_tasks_insert_hr    on public.onboarding_tasks;
drop policy if exists onboarding_tasks_update_admin on public.onboarding_tasks;
drop policy if exists onboarding_tasks_update_hr    on public.onboarding_tasks;
drop policy if exists onboarding_tasks_delete_admin on public.onboarding_tasks;
drop policy if exists onboarding_tasks_delete_hr    on public.onboarding_tasks;

create policy onboarding_tasks_select
  on public.onboarding_tasks for select
  to authenticated
  using (
    public.is_hr()
    or employee_id = public.current_employee_id()
  );

create policy onboarding_tasks_insert_hr
  on public.onboarding_tasks for insert
  to authenticated
  with check (public.is_hr());

create policy onboarding_tasks_update_hr
  on public.onboarding_tasks for update
  to authenticated
  using (public.is_hr())
  with check (public.is_hr());

create policy onboarding_tasks_delete_hr
  on public.onboarding_tasks for delete
  to authenticated
  using (public.is_hr());

-- ============================================================================
-- employee_contracts
-- ============================================================================
drop policy if exists employee_contracts_select       on public.employee_contracts;
drop policy if exists employee_contracts_insert_admin on public.employee_contracts;
drop policy if exists employee_contracts_insert_hr    on public.employee_contracts;
drop policy if exists employee_contracts_update_admin on public.employee_contracts;
drop policy if exists employee_contracts_update_hr    on public.employee_contracts;
drop policy if exists employee_contracts_delete_admin on public.employee_contracts;
drop policy if exists employee_contracts_delete_hr    on public.employee_contracts;

create policy employee_contracts_select
  on public.employee_contracts for select
  to authenticated
  using (
    public.is_hr()
    or employee_id = public.current_employee_id()
  );

create policy employee_contracts_insert_hr
  on public.employee_contracts for insert
  to authenticated
  with check (public.is_hr());

create policy employee_contracts_update_hr
  on public.employee_contracts for update
  to authenticated
  using (public.is_hr())
  with check (public.is_hr());

create policy employee_contracts_delete_hr
  on public.employee_contracts for delete
  to authenticated
  using (public.is_hr());

-- ============================================================================
-- training_records
-- ============================================================================
drop policy if exists training_records_select       on public.training_records;
drop policy if exists training_records_insert_admin on public.training_records;
drop policy if exists training_records_insert_hr    on public.training_records;
drop policy if exists training_records_update_admin on public.training_records;
drop policy if exists training_records_update_hr    on public.training_records;
drop policy if exists training_records_delete_admin on public.training_records;
drop policy if exists training_records_delete_hr    on public.training_records;

create policy training_records_select
  on public.training_records for select
  to authenticated
  using (
    public.is_hr()
    or employee_id = public.current_employee_id()
  );

create policy training_records_insert_hr
  on public.training_records for insert
  to authenticated
  with check (public.is_hr());

create policy training_records_update_hr
  on public.training_records for update
  to authenticated
  using (public.is_hr())
  with check (public.is_hr());

create policy training_records_delete_hr
  on public.training_records for delete
  to authenticated
  using (public.is_hr());
