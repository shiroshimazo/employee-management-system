import { supabase } from '../lib/supabase.js'

/**
 * department.service — CRUD + search + analytics for the departments table.
 *
 * Auth model:
 *   RLS in 007_rls_policies.sql gates every call. Reads are open to any
 *   authenticated user (departments are reference data); writes require
 *   admin or HR. The service does not duplicate that check client-side —
 *   the database is the source of truth, and Postgres errors surface to
 *   the caller verbatim.
 */

// ── Query shaping ───────────────────────────────────────────────────────────
//
// The manager join uses the column-name hint (!manager_id) rather than the
// auto-generated constraint name, for the same reason employee.service does:
// PostgREST resolves these reliably when you point at the FK column directly.
const DEPARTMENT_SELECT = `
  id,
  name,
  code,
  description,
  status,
  manager_id,
  created_at,
  updated_at,
  manager:profiles!manager_id (
    id,
    full_name,
    role,
    avatar_url
  )
`

// Allowlist for writes — keeps unknown fields and computed columns out.
const WRITABLE_COLUMNS = [
  'name',
  'code',
  'description',
  'status',
  'manager_id',
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

// ── Reads ───────────────────────────────────────────────────────────────────

/**
 * getDepartments(options?)
 *
 * Lists departments + their joined manager profile. Returns `{ data, count }`
 * to mirror employee.service so the page-level code can stay symmetric.
 */
export async function getDepartments({ status, ascending = true } = {}) {
  let query = supabase
    .from('departments')
    .select(DEPARTMENT_SELECT, { count: 'exact' })
    .order('name', { ascending })

  if (status) query = query.eq('status', status)

  const { data, error, count } = await query
  if (error) throw error
  return { data, count }
}

export async function getDepartmentById(id) {
  const { data, error } = await supabase
    .from('departments')
    .select(DEPARTMENT_SELECT)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

/**
 * searchDepartments(query)
 *
 * Free-text search across name / code / description. We use ILIKE for
 * case-insensitive partial matching and sanitize the term so a stray %
 * or , can't break the .or() filter syntax.
 *
 * Empty input → defer to getDepartments() so the page can reuse one
 * function for initial load and live search.
 */
export async function searchDepartments(query) {
  const q = (query ?? '').trim()
  if (!q) return getDepartments()

  const safe = q.replace(/[%,()]/g, ' ')
  const term = `%${safe}%`

  const { data, error, count } = await supabase
    .from('departments')
    .select(DEPARTMENT_SELECT, { count: 'exact' })
    .or(`name.ilike.${term},code.ilike.${term},description.ilike.${term}`)
    .order('name', { ascending: true })

  if (error) throw error
  return { data, count }
}

/**
 * getDepartmentEmployeeCount(departmentId)
 *
 * Returns the number of employees currently assigned to a department.
 * Uses HEAD + count='exact' so we never ship rows over the wire — only
 * the count header. RLS still gates this: a manager will see the count
 * of employees they're allowed to see, which is the right behavior for
 * the column on the admin page (admins/HR see the true total).
 */
export async function getDepartmentEmployeeCount(departmentId) {
  const { count, error } = await supabase
    .from('employees')
    .select('id', { count: 'exact', head: true })
    .eq('department_id', departmentId)
  if (error) throw error
  return count ?? 0
}

/**
 * getDepartmentEmployeeCounts(departmentIds)
 *
 * Batch helper for the list page — instead of firing N HEAD requests for
 * N rows in the table, we issue one query that returns all employees'
 * department_ids and tally in JS. For HR-scale datasets this is a single
 * roundtrip and a small JS reduction; promote to a SQL view if it stops
 * being. Returns a `{ [departmentId]: count }` map.
 */
export async function getDepartmentEmployeeCounts(departmentIds) {
  if (!departmentIds || departmentIds.length === 0) return {}

  const { data, error } = await supabase
    .from('employees')
    .select('department_id')
    .in('department_id', departmentIds)
  if (error) throw error

  const tally = {}
  for (const id of departmentIds) tally[id] = 0
  for (const row of data ?? []) {
    if (row.department_id != null) {
      tally[row.department_id] = (tally[row.department_id] ?? 0) + 1
    }
  }
  return tally
}

/**
 * getManagerCandidates()
 *
 * Profiles eligible to manage a department — admin / hr / manager roles.
 * Sorted by name so the dropdown reads alphabetically. We expose this as
 * its own helper rather than reusing a generic profiles list because the
 * admin/HR caller may have access to many profiles, and we want to limit
 * the dropdown to ones that make sense as a manager.
 */
export async function getManagerCandidates() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .in('role', ['admin', 'hr', 'manager'])
    .order('full_name', { ascending: true })
  if (error) throw error
  return data ?? []
}

// ── Writes ──────────────────────────────────────────────────────────────────

/**
 * createDepartment(input)
 *
 * Inserts a new department. `name` is required (and uniquely indexed at
 * the DB level — duplicate names surface as a Postgres unique-violation).
 */
export async function createDepartment(input) {
  const payload = pickWritable(input)
  if (!payload.name || !payload.name.trim()) {
    throw new Error('createDepartment requires a non-empty name.')
  }
  // Coerce blanks → null for nullable columns. Postgres rejects '' on
  // uuid columns, and treating '' as "unassigned" matches the form UX.
  if (payload.manager_id === '') payload.manager_id = null
  if (payload.code === '') payload.code = null

  const result = await supabase
    .from('departments')
    .insert(payload)
    .select(DEPARTMENT_SELECT)
    .single()
  return unwrap(result)
}

/**
 * updateDepartment(id, patch)
 *
 * Partial update; returns the joined row so the caller can refresh
 * local state without a second fetch.
 */
export async function updateDepartment(id, patch) {
  const payload = pickWritable(patch)
  if (Object.keys(payload).length === 0) {
    throw new Error('updateDepartment called with no writable fields.')
  }
  if (payload.manager_id === '') payload.manager_id = null
  if (payload.code === '') payload.code = null

  const result = await supabase
    .from('departments')
    .update(payload)
    .eq('id', id)
    .select(DEPARTMENT_SELECT)
    .single()
  return unwrap(result)
}

/**
 * deleteDepartment(id)
 *
 * Hard delete. The FK on employees.department_id has ON DELETE SET NULL,
 * so removing a department leaves employees in place with no department.
 * For a non-destructive disable, prefer
 *   updateDepartment(id, { status: 'archived' })
 */
export async function deleteDepartment(id) {
  const result = await supabase.from('departments').delete().eq('id', id)
  if (result.error) throw result.error
  return { id }
}
