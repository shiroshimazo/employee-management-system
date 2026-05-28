import { supabase } from '../lib/supabase.js'

/**
 * audit.service — append-only writer for the audit_logs table.
 *
 * Every privileged or noteworthy action in the app should emit a row here.
 * The RLS policy `audit_logs_insert_self` lets an authenticated user write
 * a row provided actor_id = auth.uid(); we set that automatically so callers
 * don't have to plumb it through.
 *
 * Reads are limited to admin/HR by `audit_logs_select_admin_hr`. The audit
 * log viewer (admin page) consumes `getAuditLogs()` from here.
 *
 * Writing is best-effort: if the call fails we log to console and swallow.
 * Failing the user's actual action because the audit row didn't write would
 * be the wrong tradeoff in 99% of cases — better to have the action succeed
 * with a missing audit row than to roll back a leave approval.
 */

const LOG_SELECT = `
  id,
  actor_id,
  action,
  target_table,
  target_id,
  meta,
  created_at,
  actor:profiles!actor_id ( id, full_name, role )
`

/**
 * writeLog({ action, target_table, target_id, meta })
 *
 * Emits an audit row attributed to the current user. Returns the inserted
 * row on success, or null on failure (after logging to console). Never
 * throws — see the file header for why.
 */
export async function writeLog({
  action,
  target_table = null,
  target_id = null,
  meta = {},
} = {}) {
  if (!action) {
    // Cheap dev-time guard. The DB also enforces NOT NULL on action.
    console.warn('audit.writeLog: action is required')
    return null
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const actorId = sessionData?.session?.user?.id ?? null

  // RLS requires actor_id = auth.uid() for the self-insert path. If we
  // don't have a session (e.g. an unauth'd context wandered in here),
  // skip the write rather than 401-ing the caller's main action.
  if (!actorId) return null

  const { data, error } = await supabase
    .from('audit_logs')
    .insert({
      actor_id: actorId,
      action,
      target_table,
      target_id,
      meta,
    })
    .select()
    .single()

  if (error) {
    // eslint-disable-next-line no-console
    console.error('audit.writeLog failed:', error)
    return null
  }
  return data
}

/**
 * getAuditLogs(options?) — admin/HR-only feed.
 *
 * Joined with the actor profile so the UI can render a friendly name
 * without an extra fetch. Newest first; default limit keeps the payload
 * sensible for a dashboard widget.
 */
export async function getAuditLogs({ limit = 50, action } = {}) {
  let query = supabase
    .from('audit_logs')
    .select(LOG_SELECT)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (action) query = query.eq('action', action)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}
