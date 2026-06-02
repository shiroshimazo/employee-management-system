import { supabase } from '../lib/supabase.js'

export const EMPTY_PAYROLL_DASHBOARD_METRICS = {
  generatedAt: null,
  kpis: {
    activePayroll: 0,
    salariedEmployees: 0,
    salaryTotal: 0,
    averageSalary: 0,
    missingSalary: 0,
  },
  departmentCosts: [],
  statusBreakdown: [],
  attention: {
    missingSalaries: [],
  },
}

export const EMPTY_PAYROLL_SALARY_RECORDS = {
  count: 0,
  rows: [],
  kpis: {
    totalEmployees: 0,
    salariedEmployees: 0,
    missingSalary: 0,
    salaryTotal: 0,
    averageSalary: 0,
  },
}

export const EMPTY_PAYROLL_RUNS = {
  count: 0,
  rows: [],
}

function numberOrZero(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function normalizeUserRef(user = null) {
  if (!user) return null

  return {
    id: user.id ?? null,
    name: user.name ?? 'Unknown user',
  }
}

function normalizeKpis(kpis = {}) {
  return {
    activePayroll: numberOrZero(kpis.activePayroll),
    salariedEmployees: numberOrZero(kpis.salariedEmployees),
    salaryTotal: numberOrZero(kpis.salaryTotal),
    averageSalary: numberOrZero(kpis.averageSalary),
    missingSalary: numberOrZero(kpis.missingSalary),
  }
}

function normalizeDepartmentCosts(rows = []) {
  return rows.map((row) => ({
    department: row.department ?? 'Unassigned',
    code: row.code ?? null,
    employees: numberOrZero(row.employees),
    salaryTotal: numberOrZero(row.salaryTotal),
    averageSalary: numberOrZero(row.averageSalary),
  }))
}

function normalizeStatusBreakdown(rows = []) {
  return rows.map((row) => ({
    status: row.status ?? 'unknown',
    employees: numberOrZero(row.employees),
    salaryTotal: numberOrZero(row.salaryTotal),
  }))
}

function normalizeMissingSalaries(rows = []) {
  return rows.map((row) => ({
    id: row.id,
    employeeNumber: row.employeeNumber ?? '—',
    name: row.name ?? 'Unnamed employee',
    department: row.department ?? 'Unassigned',
    status: row.status ?? 'unknown',
  }))
}

function normalizeSalaryKpis(kpis = {}) {
  return {
    totalEmployees: numberOrZero(kpis.totalEmployees),
    salariedEmployees: numberOrZero(kpis.salariedEmployees),
    missingSalary: numberOrZero(kpis.missingSalary),
    salaryTotal: numberOrZero(kpis.salaryTotal),
    averageSalary: numberOrZero(kpis.averageSalary),
  }
}

function normalizeSalaryRecord(row = {}) {
  return {
    id: row.id,
    employeeNumber: row.employeeNumber ?? '—',
    name: row.name ?? 'Unnamed employee',
    position: row.position ?? '—',
    employmentType: row.employmentType ?? 'unknown',
    status: row.status ?? 'unknown',
    hireDate: row.hireDate ?? null,
    salary: row.salary == null ? null : numberOrZero(row.salary),
    updatedAt: row.updatedAt ?? null,
    department: {
      id: row.department?.id ?? null,
      name: row.department?.name ?? 'Unassigned',
      code: row.department?.code ?? null,
    },
  }
}

function normalizePayrollRun(row = {}) {
  return {
    id: row.id,
    name: row.name ?? 'Payroll run',
    periodStart: row.periodStart ?? null,
    periodEnd: row.periodEnd ?? null,
    status: row.status ?? 'draft',
    employeeCount: numberOrZero(row.employeeCount),
    salaryTotal: numberOrZero(row.salaryTotal),
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
    createdBy: normalizeUserRef(row.createdBy),
    approvedAt: row.approvedAt ?? null,
    approvedBy: normalizeUserRef(row.approvedBy),
  }
}

export async function getPayrollDashboardMetrics() {
  const { data, error } = await supabase.rpc('get_payroll_dashboard_metrics')
  if (error) throw error

  const raw = data ?? EMPTY_PAYROLL_DASHBOARD_METRICS

  return {
    generatedAt: raw.generatedAt ?? null,
    kpis: normalizeKpis(raw.kpis),
    departmentCosts: normalizeDepartmentCosts(raw.departmentCosts),
    statusBreakdown: normalizeStatusBreakdown(raw.statusBreakdown),
    attention: {
      missingSalaries: normalizeMissingSalaries(raw.attention?.missingSalaries),
    },
  }
}

export async function getPayrollSalaryRecords({
  query = '',
  status = '',
  departmentId = '',
  limit = 50,
  offset = 0,
} = {}) {
  const { data, error } = await supabase.rpc('get_payroll_salary_records', {
    p_query: query.trim(),
    p_status: status || null,
    p_department_id: departmentId || null,
    p_limit: limit,
    p_offset: offset,
  })
  if (error) throw error

  const raw = data ?? EMPTY_PAYROLL_SALARY_RECORDS

  return {
    count: numberOrZero(raw.count),
    rows: (raw.rows ?? []).map(normalizeSalaryRecord),
    kpis: normalizeSalaryKpis(raw.kpis),
  }
}

export async function getPayrollRuns({ status = '', limit = 50, offset = 0 } = {}) {
  const { data, error } = await supabase.rpc('get_payroll_runs', {
    p_status: status || null,
    p_limit: limit,
    p_offset: offset,
  })
  if (error) throw error

  const raw = data ?? EMPTY_PAYROLL_RUNS

  return {
    count: numberOrZero(raw.count),
    rows: (raw.rows ?? []).map(normalizePayrollRun),
  }
}

export async function createPayrollRun({ periodStart, periodEnd, name = '' } = {}) {
  if (!periodStart || !periodEnd) {
    throw new Error('createPayrollRun requires a period start and end date.')
  }

  const trimmedName = typeof name === 'string' ? name.trim() : ''

  const { data, error } = await supabase.rpc('create_payroll_run', {
    p_period_start: periodStart,
    p_period_end: periodEnd,
    p_name: trimmedName || null,
  })
  if (error) throw error

  return normalizePayrollRun(data)
}

export async function updatePayrollEmployeeSalary(employeeId, salary) {
  if (!employeeId) {
    throw new Error('updatePayrollEmployeeSalary requires an employee id.')
  }

  const nextSalary = salary === '' || salary == null ? null : Number(salary)
  if (nextSalary != null && (!Number.isFinite(nextSalary) || nextSalary < 0)) {
    throw new Error('Salary must be empty or a non-negative number.')
  }

  const { data, error } = await supabase.rpc('update_payroll_employee_salary', {
    p_employee_id: employeeId,
    p_salary: nextSalary,
  })
  if (error) throw error

  return normalizeSalaryRecord(data)
}
