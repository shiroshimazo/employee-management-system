import { supabase } from '../lib/supabase.js'
import { writeLog } from './audit.service.js'

/**
 * user.service — admin-facing reads + role management over the `profiles`
 * table.
 *
 * Why this is separate from profile.service:
 *   profile.service is the *self* surface (a user reading/updating their own
 *   row). This is the *admin* surface — listing everyone and changing roles.
 *   Different RLS posture, different callers, so they stay apart.
 *
 * Auth model:
 *   Listing all profiles and updating someone else's role is gated by RLS
 *   (admin-only) in 007_rls_policies.sql. We don't duplicate that check
 *   client-side — a non-admin caller's update just fails at the database with
 *   a row-level-security error, which we surface verbatim.
 *
 * No user creation here:
 *   The browser holds only the anon key, which cannot mint auth users. New
 *   users self-register at /register; this service manages the profiles that
 *   registration creates. Provisioning a login out-of-band is a server-side
 *   (service_role / Edge Function) concern, intentionally out of scope.
 */

export const ROLES = ['admin', 'hr', 'manager', 'payroll', 'employee']

// One canonical column list so list / search return the same shape.
const USER_SELECT = 'id, full_name, role, phone, avatar_url, created_at'

/**
 * getUsers(options?)
 *
 * Lists profiles with an optional role filter + pagination. Returns
 * { data, count } so the page can show "N of M" the same way the employee
 * list does — count comes from PostgREST's exact header, so it reflects what
 * the caller is actually allowed to see under RLS.
 */
export async function getUsers({
  role,
  limit = 100,
  offset = 0,
  orderBy = 'created_at',
  ascending = false,
} = {}) {
  let query = supabase
    .from('profiles')
    .select(USER_SELECT, { count: 'exact' })
    .order(orderBy, { ascending })
    .range(offset, offset + limit - 1)

  if (role) query = query.eq('role', role)

  const { data, error, count } = await query
  if (error) throw error
  return { data: data ?? [], count: count ?? 0 }
}

/**
 * searchUsers(query)
 *
 * Free-text search across full_name and phone. Mirrors the simple .or()
 * approach used elsewhere; profiles is a single flat table so there's no
 * join to split across like employees has.
 */
export async function searchUsers(query, { limit = 100 } = {}) {
  const q = (query ?? '').trim()
  if (!q) return getUsers({ limit })

  // Strip PostgREST's filter-string metacharacters so a stray comma or paren
  // in the search box can't break the .or() expression.
  const safe = q.replace(/[%,()]/g, ' ')
  const term = `%${safe}%`

  const { data, error } = await supabase
    .from('profiles')
    .select(USER_SELECT)
    .or(`full_name.ilike.${term},phone.ilike.${term}`)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return { data: data ?? [], count: data?.length ?? 0 }
}

/**
 * updateUserRole(userId, role)
 *
 * Changes a user's role and writes an audit row. The role is validated
 * against the known set here so a typo can't write garbage that the rest of
 * the app (sidebar, RLS) won't recognize — the DB likely has a CHECK too, but
 * failing early gives a clearer message than a Postgres constraint error.
 *
 * Returns the updated profile row.
 */
export async function updateUserRole(userId, role) {
  if (!userId) throw new Error('updateUserRole requires a userId.')
  if (!ROLES.includes(role)) {
    throw new Error(`Unknown role "${role}". Expected one of: ${ROLES.join(', ')}.`)
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', userId)
    .select(USER_SELECT)
    .single()
  if (error) throw error

  // Best-effort audit trail — never blocks the role change (see audit.service).
  await writeLog({
    action: 'user.role_changed',
    target_table: 'profiles',
    target_id: userId,
    meta: { role },
  })

  return data
}
