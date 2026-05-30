import { supabase } from '../lib/supabase.js'
import { writeLog } from './audit.service.js'

/**
 * settings.service — read + update the single organization settings row.
 *
 * Backed by the single-row org_settings table (see 012_create_settings.sql),
 * pinned to id = true. Any authenticated user can read; only admins can write
 * (RLS enforces it — we don't duplicate the check here, Postgres errors
 * surface verbatim).
 */

// Columns a caller is allowed to write. Anything outside this allowlist is
// dropped, so id / updated_at can't be sent in.
const WRITABLE_COLUMNS = ['organization_name', 'support_email', 'timezone']

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
 * getSettings() — the single org_settings row, or null if the migration
 * hasn't been run yet (so the UI can show a "run 012" hint instead of
 * crashing).
 */
export async function getSettings() {
  const { data, error } = await supabase
    .from('org_settings')
    .select('id, organization_name, support_email, timezone, updated_at')
    .eq('id', true)
    .maybeSingle()
  if (error) throw error
  return data
}

/**
 * updateSettings(patch) — update the singleton row and return it. Writes a
 * best-effort audit row (never blocks the update — see audit.service).
 */
export async function updateSettings(patch) {
  const payload = pickWritable(patch)
  if (Object.keys(payload).length === 0) {
    throw new Error('updateSettings called with no writable fields.')
  }

  const row = unwrap(
    await supabase
      .from('org_settings')
      .update(payload)
      .eq('id', true)
      .select('id, organization_name, support_email, timezone, updated_at')
      .single(),
  )

  await writeLog({
    action: 'settings.updated',
    target_table: 'org_settings',
    target_id: null,
    meta: { fields: Object.keys(payload) },
  })

  return row
}
