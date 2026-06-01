import { supabase } from '../lib/supabase.js'
import { writeLog } from './audit.service.js'

/**
 * leavePolicy.service — annual leave allowances per type (HR Leave Management).
 *
 * Backed by leave_policies (016_create_leave_policies.sql), one row per leave
 * type. Any authenticated user can read; only HR can update (RLS is the
 * gate). This is the org-level allowance only — per-employee balances are a
 * separate feature; per-request rules (notice/length) live in settings.service.
 */

function unwrap({ data, error }) {
  if (error) throw error
  return data
}

/**
 * getLeavePolicies() — all leave-type allowances. Ordered by allowance desc
 * then type so the most generous entitlements read first.
 */
export async function getLeavePolicies() {
  const { data, error } = await supabase
    .from('leave_policies')
    .select('leave_type, annual_allowance_days, description, updated_at')
    .order('annual_allowance_days', { ascending: false })
    .order('leave_type', { ascending: true })
  if (error) throw error
  return data ?? []
}

/**
 * updateLeavePolicy(leaveType, allowanceDays) — set one type's annual
 * allowance. Coerces + guards the number here so a bad value gives a clear
 * message instead of a Postgres constraint error. Writes a best-effort audit
 * row. Returns the updated row.
 */
export async function updateLeavePolicy(leaveType, allowanceDays) {
  if (!leaveType) throw new Error('updateLeavePolicy requires a leave type.')
  const days = Number(allowanceDays)
  if (Number.isNaN(days) || days < 0) {
    throw new Error('Allowance must be a number of 0 or more.')
  }

  const row = unwrap(
    await supabase
      .from('leave_policies')
      .update({ annual_allowance_days: days })
      .eq('leave_type', leaveType)
      .select('leave_type, annual_allowance_days, description, updated_at')
      .single(),
  )

  await writeLog({
    action: 'leave_policy.updated',
    target_table: 'leave_policies',
    target_id: null,
    meta: { leave_type: leaveType, annual_allowance_days: days },
  })

  return row
}
