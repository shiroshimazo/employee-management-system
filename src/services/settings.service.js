import { supabase } from '../lib/supabase.js'
import { writeLog } from './audit.service.js'

/**
 * settings.service — read + update the single organization settings row.
 *
 * Backed by the single-row org_settings table (see 012_create_settings.sql,
 * extended by 013_add_policy_settings.sql), pinned to id = true. Any
 * authenticated user can read; only admins can write (RLS enforces it — we
 * don't duplicate the check here, Postgres errors surface verbatim).
 *
 * Two read surfaces:
 *   - getSettings()/updateSettings(): the admin editor's load + save. These
 *     surface errors so the UI can react (e.g. show a "run the migration" hint).
 *   - getAttendancePolicy()/getLeavePolicy(): consumed by attendance/leave
 *     services on hot paths (clock-in, leave submit). These NEVER throw —
 *     a missing table/columns falls back to the hardcoded defaults that were
 *     the behavior before settings existed, so those flows can't break.
 */

// Hardcoded fallbacks — these mirror the values attendance.service used before
// settings existed, so behavior is identical when the migration hasn't run.
export const POLICY_DEFAULTS = {
  late_cutoff: '09:00',
  half_day_hours: 4,
  working_days: [1, 2, 3, 4, 5], // JS getDay(): 0=Sun … 6=Sat → Mon–Fri
  leave_min_notice_days: 0, // 0 = no restriction
  leave_max_consecutive_days: 0, // 0 = no limit
}

// Columns a caller is allowed to write. Anything outside this allowlist is
// dropped, so id / updated_at can't be sent in.
const WRITABLE_COLUMNS = [
  'organization_name',
  'support_email',
  'timezone',
  'late_cutoff',
  'half_day_hours',
  'working_days',
  'leave_min_notice_days',
  'leave_max_consecutive_days',
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

/**
 * cutoffToMinutes('HH:MM') — minutes since midnight, for the attendance
 * "late" comparison. Falls back to the default cut-off on a malformed value.
 */
export function cutoffToMinutes(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? '')
  if (!m) return cutoffToMinutes(POLICY_DEFAULTS.late_cutoff)
  return Number(m[1]) * 60 + Number(m[2])
}

/**
 * getSettings() — the single org_settings row, or null if the migration
 * hasn't been run yet (so the UI can show a "run 012" hint instead of
 * crashing). Selects '*' so it works whether or not 013 has added the policy
 * columns — naming a not-yet-existing column would error.
 */
export async function getSettings() {
  const { data, error } = await supabase
    .from('org_settings')
    .select('*')
    .eq('id', true)
    .maybeSingle()
  if (error) throw error
  return data
}

/**
 * updateSettings(patch) — update the singleton row and return it. Writes a
 * best-effort audit row (never blocks the update — see audit.service).
 */
export async function updateSettings(patch) {
  const payload = pickWritable(patch)
  if (Object.keys(payload).length === 0) {
    throw new Error('updateSettings called with no writable fields.')
  }

  const row = unwrap(
    await supabase
      .from('org_settings')
      .update(payload)
      .eq('id', true)
      .select('*')
      .single(),
  )

  await writeLog({
    action: 'settings.updated',
    target_table: 'org_settings',
    target_id: null,
    meta: { fields: Object.keys(payload) },
  })

  return row
}

// Shared non-throwing read: returns the row merged over POLICY_DEFAULTS, or
// just the defaults if anything goes wrong (missing table/columns, no session).
async function loadPolicyRow() {
  try {
    const row = await getSettings()
    if (!row) return { ...POLICY_DEFAULTS }
    // Only overlay keys that are actually present + non-null, so a row from
    // before 013 (missing policy columns) still yields the defaults.
    const merged = { ...POLICY_DEFAULTS }
    for (const key of Object.keys(POLICY_DEFAULTS)) {
      if (row[key] != null) merged[key] = row[key]
    }
    return merged
  } catch {
    return { ...POLICY_DEFAULTS }
  }
}

/**
 * getAttendancePolicy() — { lateCutoffMinutes, halfDayHours, workingDays }.
 * Never throws; consumed by attendance.service on clock in/out.
 */
export async function getAttendancePolicy() {
  const p = await loadPolicyRow()
  return {
    lateCutoffMinutes: cutoffToMinutes(p.late_cutoff),
    halfDayHours: Number(p.half_day_hours) || POLICY_DEFAULTS.half_day_hours,
    workingDays: Array.isArray(p.working_days) ? p.working_days : POLICY_DEFAULTS.working_days,
  }
}

/**
 * getLeavePolicy() — { minNoticeDays, maxConsecutiveDays }. Never throws;
 * consumed by leave.service on submit. 0 means "no restriction".
 */
export async function getLeavePolicy() {
  const p = await loadPolicyRow()
  return {
    minNoticeDays: Number(p.leave_min_notice_days) || 0,
    maxConsecutiveDays: Number(p.leave_max_consecutive_days) || 0,
  }
}
