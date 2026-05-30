import { supabase } from '../lib/supabase.js'
import { writeLog } from './audit.service.js'
import { getLeavePolicy } from './settings.service.js'

/**
 * leave.service — CRUD + workflow for the leave_requests table.
 *
 * Workflow states (enforced by the table's CHECK constraint):
 *   pending   → employee submitted, awaiting decision
 *   approved  → manager / HR / admin approved
 *   rejected  → manager / HR / admin rejected (decision_note recommended)
 *   cancelled → employee withdrew while still pending
 *
 * Auth model:
 *   RLS in 007_rls_policies.sql gates every call:
 *     - admin/HR see all and can approve/reject anything
 *     - managers see and can decide on their team's requests
 *     - employees see and can submit their own; can cancel while pending
 *   Postgres errors surface verbatim — we don't shadow them.
 *
 * Self-approval guard (req #6):
 *   The DB doesn't currently block "employee X approves their own request"
 *   for the admin/HR policy path. We add a defensive client-side check in
 *   `decide()` that compares the caller's auth.uid() against the request's
 *   employee.profile_id. It's a UX guardrail; the *real* protection should
 *   be a Postgres BEFORE UPDATE trigger. Filed as a TODO at the bottom.
 *
 * Audit logging (req #7):
 *   create / approve / reject / cancel all emit audit rows via
 *   audit.service#writeLog(). Failures there don't roll back the user's
 *   action — see audit.service for why.
 */

// ── Query shaping ───────────────────────────────────────────────────────────

const LEAVE_SELECT = `
  id,
  leave_type,
  start_date,
  end_date,
  days,
  reason,
  status,
  approved_by,
  decided_at,
  decision_note,
  attachment_url,
  created_at,
  updated_at,
  employee:employees!employee_id (
    id,
    employee_number,
    department_id,
    profile:profiles!profile_id ( id, full_name, avatar_url ),
    department:departments!department_id ( id, name )
  ),
  approver:profiles!approved_by ( id, full_name, role )
`

const WRITABLE_COLUMNS = [
  'employee_id',
  'leave_type',
  'start_date',
  'end_date',
  'days',
  'reason',
  'status',
  'attachment_url',
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

// Days between two ISO dates, inclusive of both ends. Caller may override
// by passing `days` explicitly — useful when the form excludes weekends.
function diffInclusiveDays(startISO, endISO) {
  const ms = 1000 * 60 * 60 * 24
  const a = new Date(startISO).getTime()
  const b = new Date(endISO).getTime()
  return Math.max(1, Math.round((b - a) / ms) + 1)
}

// Whole days from today (local midnight) until a 'YYYY-MM-DD' date. We build
// both dates at local midnight rather than `new Date('YYYY-MM-DD')` (which is
// UTC and can land a day off) so the notice check matches the calendar the
// employee sees. Negative if the date is in the past.
function noticeDaysUntil(startISO) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(startISO ?? '')
  if (!m) return 0
  const start = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((start - today) / (1000 * 60 * 60 * 24))
}

// ── Reads ───────────────────────────────────────────────────────────────────

/**
 * getLeaveRequests(options?)
 *
 * Lists leave requests + joined employee/profile/department/approver. Returns
 * `{ data, count }` to mirror the other services. Filters apply server-side
 * via PostgREST; date-range filters use the request's start_date.
 */
export async function getLeaveRequests({
  status,
  leaveType,
  employeeId,
  departmentId,
  startFrom,
  startTo,
  ascending = false,
  limit = 100,
  offset = 0,
} = {}) {
  let query = supabase
    .from('leave_requests')
    .select(LEAVE_SELECT, { count: 'exact' })
    .order('created_at', { ascending })
    .range(offset, offset + limit - 1)

  if (status) query = query.eq('status', status)
  if (leaveType) query = query.eq('leave_type', leaveType)
  if (employeeId) query = query.eq('employee_id', employeeId)
  if (startFrom) query = query.gte('start_date', startFrom)
  if (startTo) query = query.lte('start_date', startTo)
  // Department filter goes through the joined employees row. PostgREST
  // accepts referenced-column filters with this dot syntax.
  if (departmentId) query = query.eq('employee.department_id', departmentId)

  const { data, error, count } = await query
  if (error) throw error
  return { data: data ?? [], count: count ?? 0 }
}

export async function getLeaveRequestById(id) {
  const { data, error } = await supabase
    .from('leave_requests')
    .select(LEAVE_SELECT)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function getLeaveRequestsByEmployee(employeeId, options = {}) {
  return getLeaveRequests({ ...options, employeeId })
}

export async function getPendingLeaveRequests(options = {}) {
  return getLeaveRequests({ ...options, status: 'pending' })
}

export async function getLeaveRequestsByDepartment(departmentId, options = {}) {
  return getLeaveRequests({ ...options, departmentId })
}

// ── Validation ──────────────────────────────────────────────────────────────

/**
 * validateLeaveInput(input) — throws on the first failure.
 *
 * Mirrors the DB CHECK on (end_date >= start_date) so the error surfaces
 * before we hit Postgres, and adds the requirement that reason + leave_type
 * be present (req #6).
 */
function validateLeaveInput(input) {
  if (!input.leave_type) throw new Error('Leave type is required.')
  if (!input.reason || !String(input.reason).trim()) {
    throw new Error('Reason is required.')
  }
  if (!input.start_date) throw new Error('Start date is required.')
  if (!input.end_date) throw new Error('End date is required.')
  if (new Date(input.end_date) < new Date(input.start_date)) {
    throw new Error('End date cannot be before start date.')
  }
}

// ── Writes ──────────────────────────────────────────────────────────────────

/**
 * createLeaveRequest(input)
 *
 * Creates a pending request. RLS requires either admin/HR or that the
 * caller submit for themselves with status='pending'. We compute `days`
 * if the form didn't, force status='pending', and trim the reason.
 */
export async function createLeaveRequest(input) {
  validateLeaveInput(input)

  // Enforce the org leave policy (min notice / max length). Both default to 0
  // = no restriction, and the policy read never throws, so this is a no-op
  // until an admin sets limits in Settings.
  const policy = await getLeavePolicy()
  const requestedDays = input.days ?? diffInclusiveDays(input.start_date, input.end_date)
  if (policy.minNoticeDays > 0 && noticeDaysUntil(input.start_date) < policy.minNoticeDays) {
    throw new Error(
      `Leave must be requested at least ${policy.minNoticeDays} day${policy.minNoticeDays === 1 ? '' : 's'} in advance.`,
    )
  }
  if (policy.maxConsecutiveDays > 0 && requestedDays > policy.maxConsecutiveDays) {
    throw new Error(
      `Leave cannot exceed ${policy.maxConsecutiveDays} consecutive day${policy.maxConsecutiveDays === 1 ? '' : 's'}.`,
    )
  }

  const payload = pickWritable({
    ...input,
    status: 'pending',
    days: requestedDays,
    reason: String(input.reason).trim(),
  })
  if (!payload.employee_id) {
    throw new Error('createLeaveRequest requires employee_id.')
  }

  const row = unwrap(
    await supabase
      .from('leave_requests')
      .insert(payload)
      .select(LEAVE_SELECT)
      .single(),
  )

  await writeLog({
    action: 'leave_request.created',
    target_table: 'leave_requests',
    target_id: row.id,
    meta: {
      employee_id: row.employee?.id,
      leave_type: row.leave_type,
      start_date: row.start_date,
      end_date: row.end_date,
      days: row.days,
    },
  })

  return row
}

/**
 * updateLeaveRequest(id, patch)
 *
 * Generic partial update. Used for editing an in-flight pending request
 * (employee may correct dates / reason). Decision-flow updates should go
 * through approve / reject / cancel for the audit trail.
 */
export async function updateLeaveRequest(id, patch) {
  // If the caller is changing dates, run the same validation as create.
  if (patch.start_date || patch.end_date) {
    const existing = await getLeaveRequestById(id)
    if (!existing) throw new Error('Leave request not found.')
    validateLeaveInput({
      leave_type: patch.leave_type ?? existing.leave_type,
      reason: patch.reason ?? existing.reason,
      start_date: patch.start_date ?? existing.start_date,
      end_date: patch.end_date ?? existing.end_date,
    })
  }

  const payload = pickWritable(patch)
  if (Object.keys(payload).length === 0) {
    throw new Error('updateLeaveRequest called with no writable fields.')
  }
  if (payload.start_date && payload.end_date) {
    payload.days = patch.days ?? diffInclusiveDays(payload.start_date, payload.end_date)
  }

  return unwrap(
    await supabase
      .from('leave_requests')
      .update(payload)
      .eq('id', id)
      .select(LEAVE_SELECT)
      .single(),
  )
}

// ── Decision flow ───────────────────────────────────────────────────────────
//
// approve / reject / cancel all funnel through `decide()` so the self-approval
// guard, the timestamp, and the audit row stay in one place.

async function decide(id, { status, decision_note }) {
  // Fetch first so we can audit-log + run the self-approval guard with the
  // request's actual data. This is one extra round-trip per decision; at HR
  // volumes that's not a concern, and it keeps the audit row faithful.
  const existing = await getLeaveRequestById(id)
  if (!existing) throw new Error('Leave request not found.')

  if (status === 'approved' || status === 'rejected') {
    const { data: sessionData } = await supabase.auth.getSession()
    const callerId = sessionData?.session?.user?.id ?? null
    const requesterProfileId = existing.employee?.profile?.id ?? null
    if (callerId && requesterProfileId && callerId === requesterProfileId) {
      throw new Error('You cannot decide on your own leave request.')
    }
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const approverId = sessionData?.session?.user?.id ?? null

  const patch = {
    status,
    decision_note: decision_note ?? null,
  }
  // approved_by + decided_at: write at decision time. RLS lets the caller
  // perform the update; we set these columns ourselves so the form doesn't
  // have to know about them.
  const fullPatch = {
    ...patch,
    approved_by: approverId,
    decided_at: new Date().toISOString(),
  }

  const row = unwrap(
    await supabase
      .from('leave_requests')
      .update(fullPatch)
      .eq('id', id)
      .select(LEAVE_SELECT)
      .single(),
  )

  await writeLog({
    action: `leave_request.${status}`,
    target_table: 'leave_requests',
    target_id: id,
    meta: {
      employee_id: existing.employee?.id,
      leave_type: existing.leave_type,
      decision_note: decision_note ?? null,
    },
  })

  return row
}

export async function approveLeaveRequest(id) {
  return decide(id, { status: 'approved' })
}

export async function rejectLeaveRequest(id, reason) {
  if (!reason || !String(reason).trim()) {
    throw new Error('A rejection reason is required.')
  }
  return decide(id, { status: 'rejected', decision_note: String(reason).trim() })
}

export async function cancelLeaveRequest(id) {
  // Cancel is the employee-initiated path. RLS already restricts this to
  // the requester while status='pending'; we just mark + audit.
  const existing = await getLeaveRequestById(id)
  if (!existing) throw new Error('Leave request not found.')

  const row = unwrap(
    await supabase
      .from('leave_requests')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .select(LEAVE_SELECT)
      .single(),
  )

  await writeLog({
    action: 'leave_request.cancelled',
    target_table: 'leave_requests',
    target_id: id,
    meta: {
      employee_id: existing.employee?.id,
      leave_type: existing.leave_type,
    },
  })

  return row
}

/**
 * searchLeaveRequests(query) — convenience for the admin page.
 *
 * Free-text over the joined employee's full_name and the request reason.
 * Two passes (one per scope) merged + deduped by id, same shape as
 * employee.service#searchEmployees().
 */
export async function searchLeaveRequests(query, options = {}) {
  const q = (query ?? '').trim()
  if (!q) return getLeaveRequests(options)
  const safe = q.replace(/[%,()]/g, ' ')
  const term = `%${safe}%`

  const base = (sb) =>
    sb
      .from('leave_requests')
      .select(LEAVE_SELECT)
      .order('created_at', { ascending: false })
      .limit(options.limit ?? 100)

  const { data: byReason, error: reasonErr } = await base(supabase).ilike('reason', term)
  if (reasonErr) throw reasonErr

  const { data: byName, error: nameErr } = await base(supabase).ilike(
    'employee.profile.full_name',
    term,
  )
  if (nameErr) throw nameErr

  const seen = new Set()
  const merged = []
  for (const row of [...(byReason ?? []), ...(byName ?? [])]) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    merged.push(row)
  }
  return { data: merged, count: merged.length }
}

// TODO(security): replicate the self-approval check as a Postgres BEFORE
// UPDATE trigger so it survives a misbehaving client. The current guard is
// good enough for honest UI but is not a security boundary.
