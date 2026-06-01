import { getEmployees } from './employee.service.js'
import { getDepartments } from './department.service.js'
import { getLeaveRequests } from './leave.service.js'
import { getAttendanceRecords } from './attendance.service.js'

/**
 * report.service — real analytics aggregates for the admin Reports page.
 *
 * Unlike dashboardService (which still serves mock data for the home grid),
 * this module computes everything from the live tables via the existing
 * domain services. The strategy is "fetch raw, aggregate in JS":
 *   - one read per domain (employees / departments / leave / attendance),
 *     scoped by date where it matters, then tally locally.
 * At HR dataset sizes (hundreds–low thousands) that's a handful of round
 * trips and cheap reductions. If a table outgrows it, promote the hot
 * aggregate to a SQL view and swap the body — the returned shapes are the
 * contract the charts depend on, so keep them stable.
 *
 * RLS still applies: an admin/HR caller sees the whole org (Reports lives in
 * the admin workspace), so these totals reflect the organization.
 */

// Tints for the employee-status donut. Mirrors StatusBadge's vocabulary so a
// status reads the same color here as it does on every table chip.
const STATUS_TONE = {
  active: '#2C5EF5',
  on_leave: '#F59E0B',
  probation: '#14B8A6',
  terminated: '#EF4444',
  inactive: '#94A3B8',
}
const STATUS_LABEL = {
  active: 'Active',
  on_leave: 'On Leave',
  probation: 'Probation',
  terminated: 'Terminated',
  inactive: 'Inactive',
}

// Attendance statuses that count as "showed up" for the present/absent trend.
const PRESENT_STATUSES = new Set(['present', 'late', 'half_day', 'remote'])

// The four leave types the LeaveTypesChart renders. Other DB types (unpaid,
// maternity, paternity) are intentionally not charted here — add a series to
// the chart first if they need to appear.
const LEAVE_SERIES = ['sick', 'vacation', 'personal', 'bereavement']

// ── Date helpers (local time, matching attendance.service's convention) ──────

function localISO(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Last `n` calendar months as { key: 'YYYY-MM', label: 'Mon', last: 'YYYY-MM-DD' }
// ending with the current month. `last` is the inclusive final day of the month.
function lastNMonths(n) {
  const out = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const year = d.getFullYear()
    const month = d.getMonth() // 0-based
    const lastDay = new Date(year, month + 1, 0)
    out.push({
      key: `${year}-${String(month + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('en-US', { month: 'short' }),
      lastDate: lastDay,
    })
  }
  return out
}

// Last `n` days as { iso: 'YYYY-MM-DD', label: 'Mon' } ending today.
function lastNDays(n) {
  const out = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    out.push({ iso: localISO(d), label: d.toLocaleDateString('en-US', { weekday: 'short' }) })
  }
  return out
}

function monthKeyOf(iso) {
  // 'YYYY-MM-DD...' → 'YYYY-MM'. Guards against null/short strings.
  return typeof iso === 'string' && iso.length >= 7 ? iso.slice(0, 7) : null
}

// ── Aggregators ──────────────────────────────────────────────────────────────

function buildEmployeeStatus(employees) {
  const tally = {}
  for (const e of employees) {
    const s = e.status ?? 'active'
    tally[s] = (tally[s] ?? 0) + 1
  }
  // Stable, meaningful order; only include statuses that actually occur.
  const order = ['active', 'on_leave', 'probation', 'terminated', 'inactive']
  return order
    .filter((s) => tally[s])
    .map((s) => ({
      status: STATUS_LABEL[s] ?? s,
      value: tally[s],
      tone: STATUS_TONE[s] ?? '#94A3B8',
    }))
}

function buildDepartmentHeadcount(employees, departments) {
  // Count only employees who are part of the active workforce — terminated
  // staff shouldn't inflate a department's current headcount.
  const counts = {}
  for (const e of employees) {
    if (e.status === 'terminated' || e.status === 'inactive') continue
    const name = e.department?.name
    if (!name) continue
    counts[name] = (counts[name] ?? 0) + 1
  }
  // Seed from the active department list so a department with zero staff still
  // shows up as a 0 bar rather than vanishing.
  const rows = departments
    .filter((d) => d.status !== 'archived' && d.status !== 'inactive')
    .map((d) => ({ department: d.name, headcount: counts[d.name] ?? 0 }))

  // Include any department names found on employees but missing from the list
  // (defensive — shouldn't happen, but avoids dropping real headcount).
  for (const name of Object.keys(counts)) {
    if (!rows.some((r) => r.department === name)) {
      rows.push({ department: name, headcount: counts[name] })
    }
  }
  return rows.sort((a, b) => b.headcount - a.headcount)
}

function buildEmployeeGrowth(employees, months) {
  // Cumulative headcount at each month-end: hired on/before the month end and
  // not yet terminated by then. hire_date is the basis; fall back to created_at
  // when an employee row predates hire_date capture.
  return months.map((m) => {
    const cutoff = m.lastDate
    let total = 0
    for (const e of employees) {
      const startRaw = e.hire_date ?? e.created_at
      if (!startRaw) continue
      const start = new Date(startRaw)
      if (Number.isNaN(start.getTime()) || start > cutoff) continue
      if (e.termination_date) {
        const end = new Date(e.termination_date)
        if (!Number.isNaN(end.getTime()) && end <= cutoff) continue
      }
      total += 1
    }
    return { month: m.label, total }
  })
}

function buildLeaveTypes(leaveRows, months) {
  // Sum `days` per (month-of-start_date, leave_type) for the charted series.
  const byMonth = {}
  for (const m of months) {
    byMonth[m.key] = { month: m.label, sick: 0, vacation: 0, personal: 0, bereavement: 0 }
  }
  for (const r of leaveRows) {
    // Don't count withdrawn/denied requests as "leave taken".
    if (r.status === 'cancelled' || r.status === 'rejected') continue
    const key = monthKeyOf(r.start_date)
    const bucket = key ? byMonth[key] : null
    if (!bucket) continue
    if (LEAVE_SERIES.includes(r.leave_type)) {
      bucket[r.leave_type] += Number(r.days) || 0
    }
  }
  return months.map((m) => byMonth[m.key])
}

function buildAttendanceTrend(attendanceRows, days, totalActive) {
  // present = distinct employees with a "showed up" record that day.
  // absent  = active workforce minus those present (mirrors
  // attendance.service#getTodayAttendanceSummary, so a day with no records
  // reads as fully absent rather than silently empty).
  const presentByDay = {}
  for (const d of days) presentByDay[d.iso] = new Set()
  for (const r of attendanceRows) {
    const set = presentByDay[r.date]
    if (set && PRESENT_STATUSES.has(r.status) && r.employee?.id) {
      set.add(r.employee.id)
    }
  }
  return days.map((d) => {
    const present = presentByDay[d.iso].size
    return { day: d.label, present, absent: Math.max(0, totalActive - present) }
  })
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * getReportData() — one call that returns every aggregate the Reports page
 * renders, plus the KPI summary. Fetches raw rows across the four domains in
 * parallel, then tallies locally.
 *
 * Returns:
 *   {
 *     kpis: { totalEmployees, activeDepartments, pendingLeave, newHires },
 *     employeeStatus:      [{ status, value, tone }],
 *     departmentHeadcount: [{ department, headcount }],
 *     employeeGrowth:      [{ month, total }],
 *     leaveTypes:          [{ month, sick, vacation, personal, bereavement }],
 *     attendanceTrend:     [{ day, present, absent }],
 *   }
 */
export async function getReportData() {
  const months12 = lastNMonths(12)
  const months6 = lastNMonths(6)
  const days7 = lastNDays(7)

  const leaveFrom = months6[0].key + '-01' // first day of the 6-month window
  const attendanceFrom = days7[0].iso

  const [employeesRes, departmentsRes, leaveRes, attendanceRes] = await Promise.all([
    // Pull the full employee set for status/headcount/growth tallies.
    getEmployees({ limit: 2000 }),
    getDepartments(),
    getLeaveRequests({ startFrom: leaveFrom, limit: 2000 }),
    getAttendanceRecords({ startDate: attendanceFrom, endDate: days7[days7.length - 1].iso, limit: 5000 }),
  ])

  const employees = employeesRes.data ?? []
  const departments = departmentsRes.data ?? []
  const leaveRows = leaveRes.data ?? []
  const attendanceRows = attendanceRes.data ?? []

  const activeEmployees = employees.filter(
    (e) => e.status !== 'terminated' && e.status !== 'inactive',
  )
  const totalActive = activeEmployees.length

  // KPIs ----------------------------------------------------------------------
  const totalEmployees = employeesRes.count ?? employees.length
  const activeDepartments = departments.filter(
    (d) => d.status !== 'archived' && d.status !== 'inactive',
  ).length
  const pendingLeave = leaveRows.filter((r) => r.status === 'pending').length

  // New hires this month, from hire_date.
  const thisMonthKey = months12[months12.length - 1].key
  const newHires = employees.filter((e) => monthKeyOf(e.hire_date) === thisMonthKey).length

  return {
    kpis: {
      totalEmployees,
      activeDepartments,
      pendingLeave,
      newHires,
    },
    employeeStatus: buildEmployeeStatus(employees),
    departmentHeadcount: buildDepartmentHeadcount(employees, departments),
    employeeGrowth: buildEmployeeGrowth(employees, months12),
    leaveTypes: buildLeaveTypes(leaveRows, months6),
    attendanceTrend: buildAttendanceTrend(attendanceRows, days7, totalActive),
  }
}

// Headcount at a given month-end: hired on/before the cutoff and not yet
// terminated by then. Same rule as buildEmployeeGrowth, extracted so the
// turnover report can reuse it.
function headcountAt(employees, cutoff) {
  let total = 0
  for (const e of employees) {
    const startRaw = e.hire_date ?? e.created_at
    if (!startRaw) continue
    const start = new Date(startRaw)
    if (Number.isNaN(start.getTime()) || start > cutoff) continue
    if (e.termination_date) {
      const end = new Date(e.termination_date)
      if (!Number.isNaN(end.getTime()) && end <= cutoff) continue
    }
    total += 1
  }
  return total
}

/**
 * getTurnoverData() — hires vs exits over the last 12 months, plus a simple
 * turnover rate. Computed entirely from the employees table (hire_date /
 * termination_date) — no new schema. RLS scopes the set to what the caller
 * (admin/HR on the Reports page) may see.
 *
 * Returns:
 *   {
 *     months: [{ month, hires, exits, headcount }],
 *     totalHires, totalExits,
 *     currentHeadcount,
 *     turnoverRate,  // % = totalExits / avg(start, end headcount) * 100
 *   }
 */
export async function getTurnoverData() {
  const months = lastNMonths(12)
  const { data } = await getEmployees({ limit: 2000 })
  const employees = data ?? []

  const rows = months.map((m) => {
    const hires = employees.filter((e) => monthKeyOf(e.hire_date) === m.key).length
    const exits = employees.filter((e) => monthKeyOf(e.termination_date) === m.key).length
    return { month: m.label, hires, exits, headcount: headcountAt(employees, m.lastDate) }
  })

  const totalHires = rows.reduce((s, r) => s + r.hires, 0)
  const totalExits = rows.reduce((s, r) => s + r.exits, 0)
  const currentHeadcount = rows.length ? rows[rows.length - 1].headcount : 0
  const startHeadcount = rows.length ? rows[0].headcount : 0
  // Average of the window's start and end headcount, the usual denominator for
  // an annual turnover rate. Guard against divide-by-zero on an empty org.
  const avg = (startHeadcount + currentHeadcount) / 2
  const turnoverRate = avg > 0 ? Math.round((totalExits / avg) * 1000) / 10 : 0

  return { months: rows, totalHires, totalExits, currentHeadcount, turnoverRate }
}
