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

function numberOrZero(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
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
