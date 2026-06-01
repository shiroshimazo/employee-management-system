import { supabase } from '../lib/supabase.js'
import { writeLog } from './audit.service.js'

/**
 * document.service — HR document records on the Employee Records panel.
 *
 * Backed by employee_documents (014_create_employee_documents.sql). Documents
 * are URL references (file_url), matching the app's avatar_url / attachment_url
 * pattern — not uploaded bytes.
 *
 * Auth model (RLS in 022): HR manages documents; an employee may read their
 * own. We don't duplicate that check here — Postgres errors surface verbatim.
 */

// The doc_type vocabulary — must match the CHECK constraint in 014. Exported
// so the UI's filter + form read from the same source.
export const DOC_TYPES = [
  { value: 'contract', label: 'Contract' },
  { value: 'identification', label: 'Identification' },
  { value: 'certification', label: 'Certification' },
  { value: 'review', label: 'Review' },
  { value: 'other', label: 'Other' },
]

// Canonical select: the document plus the joined employee's name + number, so
// the vault can render "whose document" without a second fetch.
const DOCUMENT_SELECT = `
  id,
  employee_id,
  title,
  doc_type,
  file_url,
  notes,
  uploaded_by,
  created_at,
  employee:employees!employee_id (
    id,
    employee_number,
    profile:profiles!profile_id ( id, full_name )
  )
`

const WRITABLE_COLUMNS = ['employee_id', 'title', 'doc_type', 'file_url', 'notes']

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
 * getDocumentsByEmployee(employeeId) — one employee's documents, newest first.
 */
export async function getDocumentsByEmployee(employeeId) {
  if (!employeeId) return []
  const { data, error } = await supabase
    .from('employee_documents')
    .select(DOCUMENT_SELECT)
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

/**
 * getAllDocuments({ docType }) — org-wide list for the vault, newest first.
 * Optional doc_type filter applied server-side.
 */
export async function getAllDocuments({ docType } = {}) {
  let query = supabase
    .from('employee_documents')
    .select(DOCUMENT_SELECT, { count: 'exact' })
    .order('created_at', { ascending: false })
  if (docType) query = query.eq('doc_type', docType)

  const { data, error, count } = await query
  if (error) throw error
  return { data: data ?? [], count: count ?? 0 }
}

/**
 * createDocument(input) — file a document against an employee. Sets
 * uploaded_by from the session (RLS also requires HR). Writes a
 * best-effort audit row.
 */
export async function createDocument(input) {
  const payload = pickWritable(input)
  if (!payload.employee_id) throw new Error('createDocument requires employee_id.')
  if (!payload.title || !payload.title.trim()) {
    throw new Error('createDocument requires a title.')
  }
  payload.title = payload.title.trim()

  const { data: sessionData } = await supabase.auth.getSession()
  payload.uploaded_by = sessionData?.session?.user?.id ?? null

  const row = unwrap(
    await supabase
      .from('employee_documents')
      .insert(payload)
      .select(DOCUMENT_SELECT)
      .single(),
  )

  await writeLog({
    action: 'document.created',
    target_table: 'employee_documents',
    target_id: row.id,
    meta: { employee_id: row.employee_id, doc_type: row.doc_type, title: row.title },
  })

  return row
}

/**
 * deleteDocument(id) — HR only (RLS). Writes a best-effort audit row.
 */
export async function deleteDocument(id) {
  const { error } = await supabase.from('employee_documents').delete().eq('id', id)
  if (error) throw error

  await writeLog({
    action: 'document.deleted',
    target_table: 'employee_documents',
    target_id: id,
    meta: {},
  })

  return { id }
}
