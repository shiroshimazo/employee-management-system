import { supabase } from '../lib/supabase.js'
import { writeLog } from './audit.service.js'

/**
 * jobPosting.service — open roles for the HR Recruitment panel.
 *
 * Backed by job_postings (017_create_job_postings.sql). Any authenticated
 * user can read; only HR can write (RLS is the gate — we don't duplicate
 * the check, Postgres errors surface verbatim).
 */

// Canonical select: the posting plus its joined department name, so the list
// can show "which department" without a second fetch.
const POSTING_SELECT = `
  id,
  title,
  department_id,
  location,
  employment_type,
  description,
  status,
  created_at,
  updated_at,
  department:departments!department_id ( id, name )
`

const WRITABLE_COLUMNS = [
  'title',
  'department_id',
  'location',
  'employment_type',
  'description',
  'status',
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
 * getJobPostings({ status }) — postings newest first, optional status filter.
 */
export async function getJobPostings({ status } = {}) {
  let query = supabase
    .from('job_postings')
    .select(POSTING_SELECT, { count: 'exact' })
    .order('created_at', { ascending: false })
  if (status) query = query.eq('status', status)

  const { data, error, count } = await query
  if (error) throw error
  return { data: data ?? [], count: count ?? 0 }
}

/**
 * createJobPosting(input) — RLS requires HR. Coerces a blank
 * department_id to null (Postgres rejects '' on a uuid column). Audits.
 */
export async function createJobPosting(input) {
  const payload = pickWritable(input)
  if (!payload.title || !payload.title.trim()) {
    throw new Error('createJobPosting requires a title.')
  }
  payload.title = payload.title.trim()
  if (payload.department_id === '') payload.department_id = null

  const row = unwrap(
    await supabase.from('job_postings').insert(payload).select(POSTING_SELECT).single(),
  )

  await writeLog({
    action: 'job_posting.created',
    target_table: 'job_postings',
    target_id: row.id,
    meta: { title: row.title, status: row.status },
  })

  return row
}

/**
 * updateJobPosting(id, patch) — partial update; returns the joined row.
 */
export async function updateJobPosting(id, patch) {
  const payload = pickWritable(patch)
  if (Object.keys(payload).length === 0) {
    throw new Error('updateJobPosting called with no writable fields.')
  }
  if (payload.department_id === '') payload.department_id = null

  const row = unwrap(
    await supabase
      .from('job_postings')
      .update(payload)
      .eq('id', id)
      .select(POSTING_SELECT)
      .single(),
  )

  await writeLog({
    action: 'job_posting.updated',
    target_table: 'job_postings',
    target_id: id,
    meta: { fields: Object.keys(payload) },
  })

  return row
}

/**
 * deleteJobPosting(id) — HR only (RLS). Applicants.job_posting_id is
 * ON DELETE SET NULL, so removing a posting leaves its applicants in place.
 */
export async function deleteJobPosting(id) {
  const { error } = await supabase.from('job_postings').delete().eq('id', id)
  if (error) throw error

  await writeLog({
    action: 'job_posting.deleted',
    target_table: 'job_postings',
    target_id: id,
    meta: {},
  })

  return { id }
}
