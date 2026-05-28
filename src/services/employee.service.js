import { supabase } from '../lib/supabase.js'

/**
 * employee.service — single source for employees CRUD against Supabase.
 *
 * Shape:
 *   Every read returns the joined "rich" employee row — employees + the
 *   linked profile + the linked department + (optionally) the manager's
 *   profile. The UI cares about names and labels, so we shape the join
 *   here once instead of repeating the select all over the codebase.
 *
 * Auth model:
 *   The RLS policies in 007_rls_policies.sql gate every call. Mutations
 *   (create / update / delete) require admin or HR; all of these will
 *   fail with a Postgres "new row violates row-level security" error
 *   for non-privileged callers. The service does not duplicate that
 *   check client-side — the database is the source of truth.
 *
 * Auth user provisioning:
 *   `createEmployee` expects an existing `profile_id`. New auth users are
 *   created via Supabase's admin API (server-side) or by inviting via the
 *   Supabase dashboard / an Edge Function. The browser-side anon key
 *   intentionally cannot create auth users out of nowhere.
 */

// ── Query shaping ───────────────────────────────────────────────────────────
//
// One canonical select string so list / detail / search all return the same
// shape and the UI never has to branch on "did this code path remember to
// include the profile join?".
const EMPLOYEE_SELECT = `
  id,
  employee_number,
  position,
  employment_type,
  status,
  hire_date,
  termination_date,
  salary,
  created_at,
  updated_at,
  profile:profiles!employees_profile_id_fkey (
    id,
    full_name,
    role,
    phone,
    avatar_url
  ),
  department:departments!employees_department_id_fkey (
    id,
    name,
    code
  ),
  manager:employees!employees_manager_id_fkey (
    id,
    employee_number,
    profile:profiles!employees_profile_id_fkey ( id, full_name )
  )
`

// Columns the caller is allowed to send to insert/update. Anything outside
// this allowlist is silently dropped, which keeps callers from leaking
// foreign keys, audit columns, or computed fields into a write.
const WRITABLE_COLUMNS = [
  'profile_id',
  'employee_number',
  'department_id',
  'position',
  'manager_id',
  'employment_type',
  'status',
  'hire_date',
  'termination_date',
  'salary',
]

function pickWritable(input) {
  const out = {}
  for (const key of WRITABLE_COLUMNS) {
    if (input[key] !== undefined) out[key] = input[key]
  }
  return out
}

// PostgREST returns `{ data, error }`. Throw on error so callers can use
// try/catch instead of having to remember to check `.error` every time.
function unwrap({ data, error }) {
  if (error) throw error
  return data
}

// ── Reads ───────────────────────────────────────────────────────────────────

/**
 * getEmployees(options?)
 *
 * Lists employees with their joined profile + department + manager. Supports
 * status / department filters and pagination. Sorted newest hire first by
 * default — that's what the admin page tends to want on initial load.
 */
export async function getEmployees({
  status,
  departmentId,
  limit = 50,
  offset = 0,
  orderBy = 'created_at',
  ascending = false,
} = {}) {
  let query = supabase
    .from('employees')
    .select(EMPLOYEE_SELECT, { count: 'exact' })
    .order(orderBy, { ascending })
    .range(offset, offset + limit - 1)

  if (status) query = query.eq('status', status)
  if (departmentId) query = query.eq('department_id', departmentId)

  const { data, error, count } = await query
  if (error) throw error
  return { data, count }
}

/**
 * getEmployeeById(id) — single employee with the same join shape as the
 * list endpoint. Returns null on not-found rather than throwing, so the
 * caller can render a 404 state without wrapping in try/catch.
 */
export async function getEmployeeById(id) {
  const { data, error } = await supabase
    .from('employees')
    .select(EMPLOYEE_SELECT)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

/**
 * searchEmployees(query)
 *
 * Free-text search across employee_number / position and the joined
 * profile's full_name. We run the top-level filter and the joined-name
 * filter as separate queries and merge in JS — combining both inside
 * a single .or() across a join is finicky in PostgREST, and HR datasets
 * (hundreds to a few thousand rows) handle the second round-trip fine.
 *
 * If the query is empty, defer to getEmployees() — the page reuses this
 * function for both initial load and live search.
 */
export async function searchEmployees(query, { limit = 50 } = {}) {
  const q = (query ?? '').trim()
  if (!q) return getEmployees({ limit })

  // Defend against PostgREST's `,` separator and embedded `%` confusion in
  // the .or() filter string. We keep the term simple — letters/numbers/space.
  const safe = q.replace(/[%,()]/g, ' ')
  const term = `%${safe}%`

  const { data: byTopLevel, error: topErr } = await supabase
    .from('employees')
    .select(EMPLOYEE_SELECT)
    .or(`employee_number.ilike.${term},position.ilike.${term}`)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (topErr) throw topErr

  const { data: byName, error: nameErr } = await supabase
    .from('employees')
    .select(EMPLOYEE_SELECT)
    .ilike('profile.full_name', term)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (nameErr) throw nameErr

  // Dedupe by id, preserving order: top-level matches first, then name
  // matches the top-level didn't already cover.
  const seen = new Set()
  const merged = []
  for (const row of [...(byTopLevel ?? []), ...(byName ?? [])]) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    merged.push(row)
  }
  return { data: merged, count: merged.length }
}

/**
 * getEmployeesByDepartment(departmentId)
 *
 * Thin wrapper around getEmployees with a department filter — exposed
 * separately because the admin "Department detail" page reaches for this
 * exact slice and shouldn't have to know the option name.
 */
export async function getEmployeesByDepartment(departmentId, options = {}) {
  return getEmployees({ ...options, departmentId })
}

// ── Writes ──────────────────────────────────────────────────────────────────

/**
 * createEmployee(data)
 *
 * Inserts a new employee row. Requires a `profile_id` for an already
 * provisioned auth user (Supabase admin API or dashboard invite). The DB
 * will reject the call for non-admin/HR via RLS — we surface that error
 * verbatim rather than guarding here, so callers see the real reason.
 */
export async function createEmployee(input) {
  const payload = pickWritable(input)
  if (!payload.profile_id) {
    throw new Error('createEmployee requires profile_id (provision the auth user first).')
  }
  if (!payload.employee_number) {
    throw new Error('createEmployee requires employee_number.')
  }

  const result = await supabase
    .from('employees')
    .insert(payload)
    .select(EMPLOYEE_SELECT)
    .single()
  return unwrap(result)
}

/**
 * updateEmployee(id, patch)
 *
 * Partial update — only the columns in `patch` get sent. Returns the full
 * joined row so the caller can refresh its local state without a second
 * fetch.
 */
export async function updateEmployee(id, patch) {
  const payload = pickWritable(patch)
  if (Object.keys(payload).length === 0) {
    throw new Error('updateEmployee called with no writable fields.')
  }

  const result = await supabase
    .from('employees')
    .update(payload)
    .eq('id', id)
    .select(EMPLOYEE_SELECT)
    .single()
  return unwrap(result)
}

/**
 * deleteEmployee(id)
 *
 * Hard-deletes the employee row. The associated profile (and auth user) are
 * not touched — those are managed via the auth admin API. If you need a
 * soft delete, prefer `updateEmployee(id, { status: 'terminated', termination_date })`.
 */
export async function deleteEmployee(id) {
  const result = await supabase.from('employees').delete().eq('id', id)
  if (result.error) throw result.error
  return { id }
}
