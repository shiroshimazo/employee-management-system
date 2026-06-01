import { supabase } from '../lib/supabase.js'
import { writeLog } from './audit.service.js'

/**
 * onboarding.service — per-employee onboarding checklists (HR Recruitment).
 *
 * Backed by onboarding_tasks (019_create_onboarding_tasks.sql). Admin/HR add,
 * check off, and remove tasks; an employee may read their own (RLS is the
 * gate — we don't duplicate the check, Postgres errors surface verbatim).
 */

const WRITABLE_COLUMNS = ['employee_id', 'task', 'done', 'notes']

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

const TASK_SELECT = 'id, employee_id, task, done, notes, created_at'

/**
 * getOnboardingTasks(employeeId) — that employee's tasks, oldest first so the
 * checklist reads in the order tasks were added.
 */
export async function getOnboardingTasks(employeeId) {
  if (!employeeId) return []
  const { data, error } = await supabase
    .from('onboarding_tasks')
    .select(TASK_SELECT)
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

/**
 * createTask(input) — add a task for an employee. Requires employee_id + task;
 * RLS also requires admin/HR. Audits.
 */
export async function createTask(input) {
  const payload = pickWritable(input)
  if (!payload.employee_id) throw new Error('createTask requires employee_id.')
  if (!payload.task || !payload.task.trim()) {
    throw new Error('createTask requires a task.')
  }
  payload.task = payload.task.trim()

  const row = unwrap(
    await supabase.from('onboarding_tasks').insert(payload).select(TASK_SELECT).single(),
  )

  await writeLog({
    action: 'onboarding.task_created',
    target_table: 'onboarding_tasks',
    target_id: row.id,
    meta: { employee_id: row.employee_id, task: row.task },
  })

  return row
}

/**
 * setTaskDone(id, done) — check or uncheck a task. Returns the updated row.
 */
export async function setTaskDone(id, done) {
  const row = unwrap(
    await supabase
      .from('onboarding_tasks')
      .update({ done: Boolean(done) })
      .eq('id', id)
      .select(TASK_SELECT)
      .single(),
  )

  await writeLog({
    action: 'onboarding.task_updated',
    target_table: 'onboarding_tasks',
    target_id: id,
    meta: { done: Boolean(done) },
  })

  return row
}

/**
 * deleteTask(id) — admin/HR only (RLS). Audits.
 */
export async function deleteTask(id) {
  const { error } = await supabase.from('onboarding_tasks').delete().eq('id', id)
  if (error) throw error

  await writeLog({
    action: 'onboarding.task_deleted',
    target_table: 'onboarding_tasks',
    target_id: id,
    meta: {},
  })

  return { id }
}
