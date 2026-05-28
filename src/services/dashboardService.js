/**
 * dashboardService — single source for every dashboard widget's data.
 *
 * The whole module is intentionally async + Promise-shaped so the UI can hit
 * these functions today (they resolve mock data) and continue working when
 * we swap each body for a real Supabase query later. The shape each function
 * returns is the contract — keep it stable when wiring up the real DB.
 *
 * Suggested replacement pattern:
 *
 *   export async function getEmployeeGrowth() {
 *     const { data, error } = await supabase
 *       .from('v_monthly_employee_growth')   // a SQL view
 *       .select('month, total, hires, exits')
 *     if (error) throw error
 *     return data
 *   }
 */

// ── Mock data ───────────────────────────────────────────────────────────────

const MOCK_KPIS = {
  totalEmployees: { value: 248, delta: '+12', direction: 'up', period: 'vs last month' },
  activeDepartments: { value: 14, delta: '0', direction: 'flat', period: 'no change' },
  pendingLeave: { value: 7, delta: '−3', direction: 'down', period: 'vs last week' },
  newHires: { value: 5, delta: '+2', direction: 'up', period: 'this month' },
}

const MOCK_EMPLOYEE_GROWTH = [
  { month: 'Jan', total: 198, hires: 6, exits: 2 },
  { month: 'Feb', total: 204, hires: 8, exits: 2 },
  { month: 'Mar', total: 211, hires: 9, exits: 2 },
  { month: 'Apr', total: 215, hires: 7, exits: 3 },
  { month: 'May', total: 222, hires: 10, exits: 3 },
  { month: 'Jun', total: 228, hires: 8, exits: 2 },
  { month: 'Jul', total: 230, hires: 5, exits: 3 },
  { month: 'Aug', total: 234, hires: 6, exits: 2 },
  { month: 'Sep', total: 239, hires: 7, exits: 2 },
  { month: 'Oct', total: 242, hires: 5, exits: 2 },
  { month: 'Nov', total: 245, hires: 5, exits: 2 },
  { month: 'Dec', total: 248, hires: 5, exits: 2 },
]

const MOCK_DEPARTMENT_HEADCOUNT = [
  { department: 'Engineering', headcount: 78 },
  { department: 'Sales', headcount: 42 },
  { department: 'Customer Success', headcount: 31 },
  { department: 'Marketing', headcount: 24 },
  { department: 'Finance', headcount: 18 },
  { department: 'People Ops', headcount: 14 },
  { department: 'Design', headcount: 22 },
  { department: 'Operations', headcount: 19 },
]

const MOCK_EMPLOYEE_STATUS = [
  { status: 'Active', value: 218, tone: '#2C5EF5' },
  { status: 'On Leave', value: 14, tone: '#F59E0B' },
  { status: 'Probation', value: 11, tone: '#14B8A6' },
  { status: 'Inactive', value: 5, tone: '#94A3B8' },
]

const MOCK_ATTENDANCE_TREND = [
  { day: 'Mon', present: 232, absent: 16 },
  { day: 'Tue', present: 240, absent: 8 },
  { day: 'Wed', present: 238, absent: 10 },
  { day: 'Thu', present: 235, absent: 13 },
  { day: 'Fri', present: 218, absent: 30 },
  { day: 'Sat', present: 96, absent: 152 },
  { day: 'Sun', present: 42, absent: 206 },
]

const MOCK_LEAVE_TYPES = [
  { month: 'Jan', sick: 12, vacation: 18, personal: 6, bereavement: 1 },
  { month: 'Feb', sick: 10, vacation: 14, personal: 5, bereavement: 0 },
  { month: 'Mar', sick: 14, vacation: 22, personal: 8, bereavement: 2 },
  { month: 'Apr', sick: 11, vacation: 25, personal: 7, bereavement: 1 },
  { month: 'May', sick: 9, vacation: 31, personal: 6, bereavement: 0 },
  { month: 'Jun', sick: 13, vacation: 38, personal: 9, bereavement: 1 },
]

const MOCK_RECENT_EMPLOYEES = [
  { id: '1', name: 'Amelia Hart', role: 'Senior Designer', department: 'Design', joinedAt: '2026-05-22', status: 'Active' },
  { id: '2', name: 'Noah Reyes', role: 'Backend Engineer', department: 'Engineering', joinedAt: '2026-05-19', status: 'Probation' },
  { id: '3', name: 'Sofia Tanaka', role: 'Account Executive', department: 'Sales', joinedAt: '2026-05-14', status: 'Active' },
  { id: '4', name: 'Liam Bennett', role: 'CS Specialist', department: 'Customer Success', joinedAt: '2026-05-10', status: 'Active' },
  { id: '5', name: 'Priya Suresh', role: 'Marketing Lead', department: 'Marketing', joinedAt: '2026-05-04', status: 'Active' },
]

const MOCK_PENDING_LEAVE = [
  { id: 'lr-201', employee: 'Marcus Cole', avatarSeed: 'MC', type: 'Vacation', from: '2026-06-02', to: '2026-06-09', days: 6, requestedAt: '2026-05-26' },
  { id: 'lr-202', employee: 'Diana Park', avatarSeed: 'DP', type: 'Sick', from: '2026-05-29', to: '2026-05-30', days: 2, requestedAt: '2026-05-27' },
  { id: 'lr-203', employee: 'Ravi Anand', avatarSeed: 'RA', type: 'Personal', from: '2026-06-12', to: '2026-06-12', days: 1, requestedAt: '2026-05-25' },
  { id: 'lr-204', employee: 'Elena Rossi', avatarSeed: 'ER', type: 'Vacation', from: '2026-07-01', to: '2026-07-14', days: 10, requestedAt: '2026-05-24' },
]

const MOCK_AUDIT_LOG = [
  { id: 'a1', actor: 'Marcus Cole', action: 'updated_employee', target: 'Sofia Tanaka', meta: 'Promoted to Senior AE', at: '2026-05-28T09:42:00Z' },
  { id: 'a2', actor: 'System', action: 'leave_approved', target: 'James Wilson', meta: 'Vacation · 5 days', at: '2026-05-28T08:15:00Z' },
  { id: 'a3', actor: 'Amelia Hart', action: 'created_department', target: 'Brand Studio', meta: '4 seats allocated', at: '2026-05-27T17:03:00Z' },
  { id: 'a4', actor: 'Marcus Cole', action: 'archived_employee', target: 'Tom Reyes', meta: 'Reason: relocation', at: '2026-05-27T11:21:00Z' },
  { id: 'a5', actor: 'System', action: 'payroll_run', target: 'May 2026 cycle', meta: '248 employees · $1.42M', at: '2026-05-26T22:00:00Z' },
]

const MOCK_EVENTS = [
  { id: 'e1', title: 'Quarterly all-hands', when: '2026-05-30T16:00:00Z', kind: 'meeting', owner: 'People Ops' },
  { id: 'e2', title: 'Performance review cycle opens', when: '2026-06-03T09:00:00Z', kind: 'cycle', owner: 'HRBPs' },
  { id: 'e3', title: 'Onboarding · 3 new hires', when: '2026-06-05T09:30:00Z', kind: 'onboarding', owner: 'People Ops' },
  { id: 'e4', title: 'Compliance training deadline', when: '2026-06-15T23:59:00Z', kind: 'deadline', owner: 'Legal' },
]

// ── Public API ──────────────────────────────────────────────────────────────
//
// All getters are async to mirror the Supabase shape. Replace the body with
// `supabase.from(...).select(...)` once the corresponding tables/views exist.

export async function getKpiSummary() {
  return MOCK_KPIS
}

export async function getEmployeeGrowth() {
  return MOCK_EMPLOYEE_GROWTH
}

export async function getDepartmentHeadcount() {
  return MOCK_DEPARTMENT_HEADCOUNT
}

export async function getEmployeeStatus() {
  return MOCK_EMPLOYEE_STATUS
}

export async function getAttendanceTrend() {
  return MOCK_ATTENDANCE_TREND
}

export async function getLeaveTypes() {
  return MOCK_LEAVE_TYPES
}

export async function getRecentEmployees() {
  return MOCK_RECENT_EMPLOYEES
}

export async function getPendingLeaveRequests() {
  return MOCK_PENDING_LEAVE
}

export async function getAuditLog() {
  return MOCK_AUDIT_LOG
}

export async function getUpcomingEvents() {
  return MOCK_EVENTS
}

// Mutations — return a Promise so the UI can await + refresh. Today they
// just resolve; the real version will write to Supabase and re-fetch.
export async function approveLeaveRequest(id) {
  return { id, status: 'approved' }
}
export async function rejectLeaveRequest(id) {
  return { id, status: 'rejected' }
}
