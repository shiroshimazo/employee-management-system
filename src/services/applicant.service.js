import { supabase } from '../lib/supabase.js'
import { writeLog } from './audit.service.js'

/**
 * applicant.service — candidates in the hiring pipeline (HR Recruitment).
 *
 * Backed by applicants (018_create_applicants.sql). Admin/HR only for every
 * operation (RLS is the gate — applicants are external candidates, not staff).
 *
 * Marking stage = 'hired' here does NOT create an employee/auth record — the
 * anon key can't mint auth users, so provisioning stays a separate concern.
 */

// The pipeline stages — must match the CHECK in 018. Exported so the UI's
// filter + stage picker read from the same source.
export const STAGES = [
  { value: 'applied', label: 'Applied' },
  { value: 'screening', label: 'Screening' },
  { value: 'interview', label: 'Interview' },
  { value: 'offer', label: 'Offer' },
  { value: 'hired', label: 'Hired' },
  { value: 'rejected', label: 'Rejected' },
]

// Canonical select: the applicant plus the joined posting title, so the list
// can show "which role" without a second fetch.
const APPLICANT_SELECT = `
  id,
  job_posting_id,
  name,
  email,
  phone,
  resume_url,
  stage,
  notes,
  created_at,
  updated_at,
  posting:job_postings!job_posting_id ( id, title )
`

const WRITABLE_COLUMNS = ['job_posting_id', 'name', 'email', 'phone', 'resume_url', 'stage', 'notes']

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
 * getApplicants({ jobPostingId, stage }) — newest first, optional filters.
 */
export async function getApplicants({ jobPostingId, stage } = {}) {
  let query = supabase
    .from('applicants')
    .select(APPLICANT_SELECT, { count: 'exact' })
    .order('created_at', { ascending: false })
  if (jobPostingId) query = query.eq('job_posting_id', jobPostingId)
  if (stage) query = query.eq('stage', stage)

  const { data, error, count } = await query
  if (error) throw error
  return { data: data ?? [], count: count ?? 0 }
}

/**
 * createApplicant(input) — RLS requires admin/HR. Coerces a blank
 * job_posting_id to null (Postgres rejects '' on a uuid column). Audits.
 */
export async function createApplicant(input) {
  const payload = pickWritable(input)
  if (!payload.name || !payload.name.trim()) {
    throw new Error('createApplicant requires a name.')
  }
  payload.name = payload.name.trim()
  if (payload.job_posting_id === '') payload.job_posting_id = null

  const row = unwrap(
    await supabase.from('applicants').insert(payload).select(APPLICANT_SELECT).single(),
  )

  await writeLog({
    action: 'applicant.created',
    target_table: 'applicants',
    target_id: row.id,
    meta: { name: row.name, stage: row.stage, job_posting_id: row.job_posting_id },
  })

  return row
}

/**
 * updateApplicantStage(id, stage) — move a candidate through the pipeline.
 * Returns the joined row so the caller can refresh in place.
 */
export async function updateApplicantStage(id, stage) {
  if (!STAGES.some((s) => s.value === stage)) {
    throw new Error(`Unknown stage "${stage}".`)
  }

  const row = unwrap(
    await supabase
      .from('applicants')
      .update({ stage })
      .eq('id', id)
      .select(APPLICANT_SELECT)
      .single(),
  )

  await writeLog({
    action: 'applicant.stage_changed',
    target_table: 'applicants',
    target_id: id,
    meta: { stage },
  })

  return row
}

/**
 * deleteApplicant(id) — admin/HR only (RLS). Audits.
 */
export async function deleteApplicant(id) {
  const { error } = await supabase.from('applicants').delete().eq('id', id)
  if (error) throw error

  await writeLog({
    action: 'applicant.deleted',
    target_table: 'applicants',
    target_id: id,
    meta: {},
  })

  return { id }
}
