import { supabase } from '../lib/supabase.js'
import { writeLog } from './audit.service.js'

/**
 * training.service — employee training / certification records (HR Compliance).
 *
 * Backed by training_records (021_create_training_records.sql). HR manages;
 * an employee may read their own (RLS is the gate — we don't duplicate
 * the check, Postgres errors surface verbatim).
 */

export const TRAINING_STATUSES = [
  { value: 'completed', label: 'Completed' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'expired', label: 'Expired' },
]

// Canonical select: record + joined employee name/number, so the list can show
// "whose training" without a second fetch.
const TRAINING_SELECT = `
  id,
  employee_id,
  course,
  provider,
  completed_date,
  expiry_date,
  status,
  notes,
  created_at,
  updated_at,
  employee:employees!employee_id (
    id,
    employee_number,
    profile:profiles!profile_id ( id, full_name )
  )
`

const WRITABLE_COLUMNS = [
  'employee_id',
  'course',
  'provider',
  'completed_date',
  'expiry_date',
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

/**
 * getTrainingRecords({ status }) — newest first, optional status filter.
 */
export async function getTrainingRecords({ status } = {}) {
  let query = supabase
    .from('training_records')
    .select(TRAINING_SELECT, { count: 'exact' })
    .order('created_at', { ascending: false })
  if (status) query = query.eq('status', status)

  const { data, error, count } = await query
  if (error) throw error
  return { data: data ?? [], count: count ?? 0 }
}

/**
 * createTrainingRecord(input) — RLS requires HR. Blank dates → null
 * (Postgres rejects '' on a date column). Audits.
 */
export async function createTrainingRecord(input) {
  const payload = pickWritable(input)
  if (!payload.employee_id) throw new Error('createTrainingRecord requires employee_id.')
  if (!payload.course || !payload.course.trim()) {
    throw new Error('createTrainingRecord requires a course.')
  }
  payload.course = payload.course.trim()
  if (payload.completed_date === '') payload.completed_date = null
  if (payload.expiry_date === '') payload.expiry_date = null

  const row = unwrap(
    await supabase.from('training_records').insert(payload).select(TRAINING_SELECT).single(),
  )

  await writeLog({
    action: 'training.created',
    target_table: 'training_records',
    target_id: row.id,
    meta: { employee_id: row.employee_id, course: row.course, status: row.status },
  })

  return row
}

/**
 * updateTrainingRecord(id, patch) — partial update; returns the joined row.
 */
export async function updateTrainingRecord(id, patch) {
  const payload = pickWritable(patch)
  if (Object.keys(payload).length === 0) {
    throw new Error('updateTrainingRecord called with no writable fields.')
  }
  if (payload.completed_date === '') payload.completed_date = null
  if (payload.expiry_date === '') payload.expiry_date = null

  const row = unwrap(
    await supabase
      .from('training_records')
      .update(payload)
      .eq('id', id)
      .select(TRAINING_SELECT)
      .single(),
  )

  await writeLog({
    action: 'training.updated',
    target_table: 'training_records',
    target_id: id,
    meta: { fields: Object.keys(payload) },
  })

  return row
}

/**
 * deleteTrainingRecord(id) — HR only (RLS). Audits.
 */
export async function deleteTrainingRecord(id) {
  const { error } = await supabase.from('training_records').delete().eq('id', id)
  if (error) throw error

  await writeLog({
    action: 'training.deleted',
    target_table: 'training_records',
    target_id: id,
    meta: {},
  })

  return { id }
}
