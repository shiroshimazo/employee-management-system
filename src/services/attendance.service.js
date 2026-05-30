import { supabase } from '../lib/supabase.js'
import { writeLog } from './audit.service.js'
import { getAttendancePolicy } from './settings.service.js'

/**
 * attendance.service — daily clock-in/out ledger backed by `public.attendance`.
 *
 * Schema bridge:
 *   The DB columns are check_in / check_out / notes / status('leave'); the UI
 *   talks about clock_in / clock_out / remarks / on_leave. We keep the DB
 *   names in the wire format and let the UI humanize via StatusBadge.
 *   `total_hours` is derived on read — there's no DB column for it.
 *
 * Auth model:
 *   RLS in 007_rls_policies.sql gates every call:
 *     - admin/HR: full read + write across the table
 *     - manager:  reads their team via manages_employee()
 *     - employee: reads their own punches; can insert/update their own
 *                 punches (via attendance_insert_self / _update_self);
 *                 cannot delete (admin/HR only).
 *
 * Attendance policy:
 *   The late cut-off, half-day threshold, and working days come from
 *   org_settings via settings.service#getAttendancePolicy(), which falls back
 *   to sensible defaults (09:00 / 4h / Mon–Fri) when the settings row or its
 *   policy columns aren't present — so this service works before the migration.
 *
 * Validation guarantees enforced here:
 *   - cannot clock in twice on the same day
 *   - cannot clock out without a prior clock-in
 *   - cannot clock out twice
 *   - clock-out must be after clock-in
 *   - if today's leave_request is approved, today's punch defaults to 'leave'
 */


// ── Query shaping ───────────────────────────────────────────────────────────

const ATTENDANCE_SELECT = `
  id,
  date,
  check_in,
  check_out,
  status,
  notes,
  created_at,
  updated_at,
  employee:employees!employee_id (
    id,
    employee_number,
    department_id,
    profile:profiles!profile_id ( id, full_name, avatar_url ),
    department:departments!department_id ( id, name )
  )
`

const WRITABLE_COLUMNS = [
  'employee_id',
  'date',
  'check_in',
  'check_out',
  'status',
  'notes',
]

function pickWritable(input) {
  const out = {}
  for (const key of WRITABLE_COLUMNS) {
    if (input[key] !== undefined) out[key] = input[key]
  }
  return out
}

function unwrap({ data, error }) {
  if (error) throw error
  return data
}

// ── Date / time helpers ─────────────────────────────────────────────────────

/**
 * todayLocalISO() — YYYY-MM-DD in the user's local timezone.
 *
 * `Date#toISOString()` returns UTC, which silently breaks if a user clocks
 * in late at night and crosses the UTC date boundary. We format in local
 * time so the punch lands on the calendar day the user thinks it's on.
 */
export function todayLocalISO() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * computeTotalHours(check_in, check_out)
 *
 * Returns hours as a float (e.g. 7.5), or null if either side is missing.
 * Exposed so list views can render it without re-implementing the math.
 */
export function computeTotalHours(checkInISO, checkOutISO) {
  if (!checkInISO || !checkOutISO) return null
  const a = new Date(checkInISO).getTime()
  const b = new Date(checkOutISO).getTime()
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return 0
  return Math.round(((b - a) / 3_600_000) * 100) / 100
}

/**
 * decorateRow(row) — adds `total_hours` to a row without mutating it.
 *
 * Recharts / table views can use the field without an extra computation
 * step at render time.
 */
function decorateRow(row) {
  if (!row) return row
  return { ...row, total_hours: computeTotalHours(row.check_in, row.check_out) }
}

function decorate(rows) {
  return (rows ?? []).map(decorateRow)
}

// ── Reads ───────────────────────────────────────────────────────────────────

/**
 * getAttendanceRecords(options?)
 *
 * Lists attendance + joined employee/profile/department. Date filters bind
 * to `attendance.date` (the calendar day), not to check_in.
 */
export async function getAttendanceRecords({
  status,
  departmentId,
  employeeId,
  startDate,
  endDate,
  ascending = false,
  limit = 200,
  offset = 0,
} = {}) {
  let query = supabase
    .from('attendance')
    .select(ATTENDANCE_SELECT, { count: 'exact' })
    .order('date', { ascending })
    .order('check_in', { ascending })
    .range(offset, offset + limit - 1)

  if (status) query = query.eq('status', status)
  if (employeeId) query = query.eq('employee_id', employeeId)
  if (startDate) query = query.gte('date', startDate)
  if (endDate) query = query.lte('date', endDate)
  if (departmentId) query = query.eq('employee.department_id', departmentId)

  const { data, error, count } = await query
  if (error) throw error
  return { data: decorate(data), count: count ?? 0 }
}

export async function getAttendanceById(id) {
  const { data, error } = await supabase
    .from('attendance')
    .select(ATTENDANCE_SELECT)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return decorateRow(data)
}

export async function getAttendanceByEmployee(employeeId, options = {}) {
  return getAttendanceRecords({ ...options, employeeId })
}

export async function getAttendanceByDateRange(startDate, endDate, options = {}) {
  return getAttendanceRecords({ ...options, startDate, endDate })
}

export async function getDepartmentAttendance(departmentId, options = {}) {
  return getAttendanceRecords({ ...options, departmentId })
}

/**
 * getTodayAttendance(employeeId) — one row or null.
 *
 * Used by the clock card to know which button (in vs out) to show, and
 * whether the day's punch is already complete.
 */
export async function getTodayAttendance(employeeId) {
  if (!employeeId) return null
  const { data, error } = await supabase
    .from('attendance')
    .select(ATTENDANCE_SELECT)
    .eq('employee_id', employeeId)
    .eq('date', todayLocalISO())
    .maybeSingle()
  if (error) throw error
  return decorateRow(data)
}

// ── Today summary ──────────────────────────────────────────────────────────

/**
 * getTodayAttendanceSummary()
 *
 * Returns counts per status for today plus a derived `absent` count
 * (active employees the caller can see, minus everyone who has a
 * non-absent record today). RLS scopes both queries — admin/HR see
 * the org total; managers see their team-scoped total.
 *
 * On a non-working day (per the org's working_days policy) we don't derive
 * absences — otherwise a weekend would read as everyone-absent. We return
 * `absent: 0` and a `nonWorkingDay: true` flag the UI can surface.
 */
export async function getTodayAttendanceSummary() {
  const today = todayLocalISO()
  const { workingDays } = await getAttendancePolicy()
  const isWorkingDay = workingDays.includes(new Date().getDay())

  const [{ data: rows, error: attErr }, { count: activeEmp, error: empErr }] = await Promise.all([
    supabase
      .from('attendance')
      .select('status, employee_id')
      .eq('date', today),
    supabase
      .from('employees')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active'),
  ])
  if (attErr) throw attErr
  if (empErr) throw empErr

  const tally = { present: 0, late: 0, half_day: 0, leave: 0, remote: 0, absent: 0 }
  const seen = new Set()
  for (const r of rows ?? []) {
    seen.add(r.employee_id)
    if (r.status && tally[r.status] !== undefined) tally[r.status] += 1
  }
  // "Absent" = active employees who have no record today. We count missing
  // records rather than rows tagged 'absent' so a quiet morning still
  // surfaces correctly — but only on working days, so weekends don't read
  // as everyone-absent.
  tally.absent = isWorkingDay ? Math.max(0, (activeEmp ?? 0) - seen.size) : 0

  return { ...tally, total: activeEmp ?? 0, nonWorkingDay: !isWorkingDay }
}

/**
 * getAttendanceStats({ employeeId, month })
 *
 * Per-employee monthly summary used by the "My Attendance" page. `month`
 * is YYYY-MM; if omitted we use the current local month. Returns counts
 * per status plus total hours logged.
 */
export async function getAttendanceStats({ employeeId, month } = {}) {
  if (!employeeId) {
    return { present: 0, late: 0, absent: 0, half_day: 0, leave: 0, total_hours: 0 }
  }
  const m = month ?? todayLocalISO().slice(0, 7)
  // Range covering the whole month: [first, lastInclusive].
  const [year, mm] = m.split('-').map(Number)
  const first = `${year}-${String(mm).padStart(2, '0')}-01`
  const lastDay = new Date(year, mm, 0).getDate()
  const last = `${year}-${String(mm).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const { data, error } = await supabase
    .from('attendance')
    .select('status, check_in, check_out')
    .eq('employee_id', employeeId)
    .gte('date', first)
    .lte('date', last)
  if (error) throw error

  const tally = { present: 0, late: 0, absent: 0, half_day: 0, leave: 0, total_hours: 0 }
  for (const row of data ?? []) {
    if (tally[row.status] !== undefined) tally[row.status] += 1
    const hrs = computeTotalHours(row.check_in, row.check_out)
    if (hrs) tally.total_hours += hrs
  }
  tally.total_hours = Math.round(tally.total_hours * 100) / 100
  return tally
}

// ── Clock in / out ──────────────────────────────────────────────────────────

/**
 * hasApprovedLeaveOn(employeeId, date)
 *
 * Helper: is there an approved leave_request that covers `date` for this
 * employee? If yes, clockIn pre-fills status='leave' instead of present
 * so the day's record is honest.
 */
async function hasApprovedLeaveOn(employeeId, date) {
  const { data, error } = await supabase
    .from('leave_requests')
    .select('id')
    .eq('employee_id', employeeId)
    .eq('status', 'approved')
    .lte('start_date', date)
    .gte('end_date', date)
    .limit(1)
  if (error) throw error
  return (data?.length ?? 0) > 0
}

function statusForCheckInTime(checkInISO, lateCutoffMinutes) {
  const d = new Date(checkInISO)
  const minutesOfDay = d.getHours() * 60 + d.getMinutes()
  return minutesOfDay > lateCutoffMinutes ? 'late' : 'present'
}

/**
 * clockIn(employeeId)
 *
 * Validates:
 *   - no existing record for today with check_in already set
 *   - if approved leave exists for today, status is forced to 'leave'
 *
 * The DB unique(employee_id, date) constraint also catches double-inserts
 * race-style, but we check first so the user gets a friendly error
 * instead of "23505 duplicate key value".
 */
export async function clockIn(employeeId) {
  if (!employeeId) throw new Error('clockIn requires employeeId.')
  const date = todayLocalISO()
  const nowISO = new Date().toISOString()
  const policy = await getAttendancePolicy()

  // Approved-leave path: short-circuit. If the day is on leave, we still
  // record a row so the table reads cleanly, but with no clock_in/out.
  const onLeave = await hasApprovedLeaveOn(employeeId, date)

  // Check for existing today record. RLS still scopes this; a row may
  // exist (e.g. HR pre-marked the day) without a check_in yet.
  const existing = await getTodayAttendance(employeeId)

  if (existing?.check_in) {
    throw new Error('You have already clocked in today.')
  }

  const status = onLeave ? 'leave' : statusForCheckInTime(nowISO, policy.lateCutoffMinutes)
  const payload = onLeave
    ? { employee_id: employeeId, date, check_in: null, status: 'leave' }
    : { employee_id: employeeId, date, check_in: nowISO, status }

  let row
  if (existing) {
    row = unwrap(
      await supabase
        .from('attendance')
        .update(payload)
        .eq('id', existing.id)
        .select(ATTENDANCE_SELECT)
        .single(),
    )
  } else {
    row = unwrap(
      await supabase
        .from('attendance')
        .insert(payload)
        .select(ATTENDANCE_SELECT)
        .single(),
    )
  }

  await writeLog({
    action: 'attendance.clocked_in',
    target_table: 'attendance',
    target_id: row.id,
    meta: { employee_id: employeeId, date, status: row.status, on_leave: onLeave },
  })

  return decorateRow(row)
}

/**
 * clockOut(employeeId)
 *
 * Validates:
 *   - today's record exists and has check_in
 *   - check_out is not already set
 *   - now > check_in
 *
 * Auto-flags `half_day` when the logged time is below HALF_DAY_HOURS.
 * We don't downgrade a 'late' status to 'half_day' if both apply — late
 * is more important to surface; the hours are still visible in the row.
 */
export async function clockOut(employeeId) {
  if (!employeeId) throw new Error('clockOut requires employeeId.')
  const existing = await getTodayAttendance(employeeId)
  if (!existing || !existing.check_in) {
    throw new Error('You must clock in before clocking out.')
  }
  if (existing.check_out) {
    throw new Error('You have already clocked out today.')
  }
  const nowISO = new Date().toISOString()
  if (new Date(nowISO) <= new Date(existing.check_in)) {
    throw new Error('Clock-out time must be after clock-in time.')
  }

  const { halfDayHours } = await getAttendancePolicy()
  const hours = computeTotalHours(existing.check_in, nowISO) ?? 0
  // Promote present → half_day when applicable; leave 'late' alone.
  const status =
    existing.status === 'present' && hours < halfDayHours ? 'half_day' : existing.status

  const row = unwrap(
    await supabase
      .from('attendance')
      .update({ check_out: nowISO, status })
      .eq('id', existing.id)
      .select(ATTENDANCE_SELECT)
      .single(),
  )

  await writeLog({
    action: 'attendance.clocked_out',
    target_table: 'attendance',
    target_id: row.id,
    meta: { employee_id: employeeId, date: existing.date, total_hours: hours, status },
  })

  return decorateRow(row)
}

// ── Admin / HR maintenance ──────────────────────────────────────────────────

/**
 * updateAttendance(id, patch)
 *
 * Manual edit by admin/HR. RLS denies non-privileged callers. Validates
 * check_out > check_in when both are present, and recomputes status if
 * the caller didn't pass one explicitly.
 */
export async function updateAttendance(id, patch) {
  const payload = pickWritable(patch)
  if (Object.keys(payload).length === 0) {
    throw new Error('updateAttendance called with no writable fields.')
  }

  // If both sides of the punch are present, sanity-check the order.
  if (payload.check_in && payload.check_out) {
    if (new Date(payload.check_out) <= new Date(payload.check_in)) {
      throw new Error('Clock-out time must be after clock-in time.')
    }
  } else if (payload.check_out && !payload.check_in) {
    // If only check_out is being set, fetch the existing row so we can
    // validate ordering against the saved check_in.
    const existing = await getAttendanceById(id)
    if (!existing?.check_in) {
      throw new Error('Cannot set clock-out without a clock-in.')
    }
    if (new Date(payload.check_out) <= new Date(existing.check_in)) {
      throw new Error('Clock-out time must be after clock-in time.')
    }
  }

  const row = unwrap(
    await supabase
      .from('attendance')
      .update(payload)
      .eq('id', id)
      .select(ATTENDANCE_SELECT)
      .single(),
  )

  await writeLog({
    action: 'attendance.edited',
    target_table: 'attendance',
    target_id: id,
    meta: { fields: Object.keys(payload) },
  })

  return decorateRow(row)
}

/**
 * deleteAttendance(id) — admin/HR only (RLS).
 */
export async function deleteAttendance(id) {
  const { error } = await supabase.from('attendance').delete().eq('id', id)
  if (error) throw error

  await writeLog({
    action: 'attendance.deleted',
    target_table: 'attendance',
    target_id: id,
    meta: {},
  })

  return { id }
}
