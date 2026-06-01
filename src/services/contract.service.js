import { supabase } from '../lib/supabase.js'
import { writeLog } from './audit.service.js'

/**
 * contract.service — employment contracts per employee (HR Compliance).
 *
 * Backed by employee_contracts (020_create_employee_contracts.sql). HR manages;
 * an employee may read their own (RLS is the gate — we don't duplicate
 * the check, Postgres errors surface verbatim).
 */

export const CONTRACT_TYPES = [
  { value: 'permanent', label: 'Permanent' },
  { value: 'fixed_term', label: 'Fixed-term' },
  { value: 'probationary', label: 'Probationary' },
  { value: 'consultancy', label: 'Consultancy' },
]

export const CONTRACT_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'expired', label: 'Expired' },
  { value: 'terminated', label: 'Terminated' },
]

// Canonical select: contract + joined employee name/number, so the list can
// show "whose contract" without a second fetch.
const CONTRACT_SELECT = `
  id,
  employee_id,
  contract_type,
  start_date,
  end_date,
  status,
  file_url,
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
  'contract_type',
  'start_date',
  'end_date',
  'status',
  'file_url',
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
 * getContracts({ status, contractType }) — newest first, optional filters.
 */
export async function getContracts({ status, contractType } = {}) {
  let query = supabase
    .from('employee_contracts')
    .select(CONTRACT_SELECT, { count: 'exact' })
    .order('created_at', { ascending: false })
  if (status) query = query.eq('status', status)
  if (contractType) query = query.eq('contract_type', contractType)

  const { data, error, count } = await query
  if (error) throw error
  return { data: data ?? [], count: count ?? 0 }
}

/**
 * createContract(input) — RLS requires HR. Blank dates → null (Postgres
 * rejects '' on a date column). Audits.
 */
export async function createContract(input) {
  const payload = pickWritable(input)
  if (!payload.employee_id) throw new Error('createContract requires employee_id.')
  if (payload.start_date === '') payload.start_date = null
  if (payload.end_date === '') payload.end_date = null

  const row = unwrap(
    await supabase.from('employee_contracts').insert(payload).select(CONTRACT_SELECT).single(),
  )

  await writeLog({
    action: 'contract.created',
    target_table: 'employee_contracts',
    target_id: row.id,
    meta: { employee_id: row.employee_id, contract_type: row.contract_type, status: row.status },
  })

  return row
}

/**
 * updateContract(id, patch) — partial update; returns the joined row.
 */
export async function updateContract(id, patch) {
  const payload = pickWritable(patch)
  if (Object.keys(payload).length === 0) {
    throw new Error('updateContract called with no writable fields.')
  }
  if (payload.start_date === '') payload.start_date = null
  if (payload.end_date === '') payload.end_date = null

  const row = unwrap(
    await supabase
      .from('employee_contracts')
      .update(payload)
      .eq('id', id)
      .select(CONTRACT_SELECT)
      .single(),
  )

  await writeLog({
    action: 'contract.updated',
    target_table: 'employee_contracts',
    target_id: id,
    meta: { fields: Object.keys(payload) },
  })

  return row
}

/**
 * deleteContract(id) — HR only (RLS). Audits.
 */
export async function deleteContract(id) {
  const { error } = await supabase.from('employee_contracts').delete().eq('id', id)
  if (error) throw error

  await writeLog({
    action: 'contract.deleted',
    target_table: 'employee_contracts',
    target_id: id,
    meta: {},
  })

  return { id }
}
