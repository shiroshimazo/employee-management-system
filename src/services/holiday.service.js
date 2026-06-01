import { supabase } from '../lib/supabase.js'
import { writeLog } from './audit.service.js'

/**
 * holiday.service — company holiday calendar (HR Leave Management panel).
 *
 * Backed by the holidays table (015_create_holidays.sql). Any authenticated
 * user can read; only HR can add or remove (RLS is the gate — we don't
 * duplicate the check, Postgres errors surface verbatim).
 */

const WRITABLE_COLUMNS = ['name', 'holiday_date', 'notes']

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
 * getHolidays() — all holidays, soonest first.
 */
export async function getHolidays() {
  const { data, error } = await supabase
    .from('holidays')
    .select('id, name, holiday_date, notes, created_at')
    .order('holiday_date', { ascending: true })
  if (error) throw error
  return data ?? []
}

/**
 * createHoliday(input) — add a holiday. Requires name + holiday_date; RLS
 * also requires HR. Writes a best-effort audit row.
 */
export async function createHoliday(input) {
  const payload = pickWritable(input)
  if (!payload.name || !payload.name.trim()) {
    throw new Error('createHoliday requires a name.')
  }
  if (!payload.holiday_date) {
    throw new Error('createHoliday requires a date.')
  }
  payload.name = payload.name.trim()

  const row = unwrap(
    await supabase
      .from('holidays')
      .insert(payload)
      .select('id, name, holiday_date, notes, created_at')
      .single(),
  )

  await writeLog({
    action: 'holiday.created',
    target_table: 'holidays',
    target_id: row.id,
    meta: { name: row.name, holiday_date: row.holiday_date },
  })

  return row
}

/**
 * deleteHoliday(id) — HR only (RLS). Writes a best-effort audit row.
 */
export async function deleteHoliday(id) {
  const { error } = await supabase.from('holidays').delete().eq('id', id)
  if (error) throw error

  await writeLog({
    action: 'holiday.deleted',
    target_table: 'holidays',
    target_id: id,
    meta: {},
  })

  return { id }
}
