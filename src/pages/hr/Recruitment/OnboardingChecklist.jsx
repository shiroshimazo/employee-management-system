import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ClipboardList, Plus, Trash2 } from 'lucide-react'
import AdminLayout from '../../../layouts/AdminLayout.jsx'
import {
  createTask,
  deleteTask,
  getOnboardingTasks,
  setTaskDone,
} from '../../../services/onboarding.service.js'
import { getEmployees } from '../../../services/employee.service.js'

/**
 * OnboardingChecklist — per-employee onboarding tasks (HR Recruitment panel).
 *
 * HR picks an employee, then adds / checks off / removes that person's
 * onboarding tasks. Backed by onboarding.service / the onboarding_tasks table.
 * If the 019 migration hasn't been run, the table is absent — we detect that
 * and show a hint instead of a broken page.
 */

function isMissingTableError(err) {
  const msg = (err?.message ?? '').toLowerCase()
  return (
    err?.code === '42P01' ||
    err?.code === 'PGRST205' ||
    (msg.includes('onboarding_tasks') && msg.includes('does not exist')) ||
    msg.includes('could not find the table')
  )
}

function OnboardingChecklist() {
  const [employees, setEmployees] = useState([])
  const [employeeId, setEmployeeId] = useState('')
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [missing, setMissing] = useState(false)

  const [newTask, setNewTask] = useState('')
  const [adding, setAdding] = useState(false)
  // Per-row pending flag so a checkbox / delete disables while saving.
  const [pendingId, setPendingId] = useState(null)

  // Employee picker options — load once on mount.
  useEffect(() => {
    let alive = true
    getEmployees({ limit: 500 })
      .then((res) => alive && setEmployees(res?.data ?? []))
      .catch(() => alive && setEmployees([]))
    return () => {
      alive = false
    }
  }, [])

  const load = useCallback(async () => {
    if (!employeeId) {
      setTasks([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await getOnboardingTasks(employeeId)
      setTasks(data ?? [])
    } catch (err) {
      if (isMissingTableError(err)) {
        setMissing(true)
      } else {
        setError(err?.message ?? 'Failed to load onboarding tasks.')
      }
      setTasks([])
    } finally {
      setLoading(false)
    }
  }, [employeeId])

  // Defer the load out of the synchronous effect body — same pattern the
  // other admin pages use to keep setState off the render path.
  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  async function handleAdd(e) {
    e.preventDefault()
    if (!newTask.trim() || !employeeId) return
    setAdding(true)
    setError(null)
    try {
      const row = await createTask({ employee_id: employeeId, task: newTask })
      setTasks((prev) => [...prev, row])
      setNewTask('')
    } catch (err) {
      if (isMissingTableError(err)) {
        setMissing(true)
      } else {
        setError(err?.message ?? 'Could not add the task.')
      }
    } finally {
      setAdding(false)
    }
  }

  async function handleToggle(task) {
    setPendingId(task.id)
    setError(null)
    try {
      const updated = await setTaskDone(task.id, !task.done)
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)))
    } catch (err) {
      setError(err?.message ?? 'Could not update the task.')
    } finally {
      setPendingId(null)
    }
  }

  async function handleDelete(task) {
    setPendingId(task.id)
    setError(null)
    try {
      await deleteTask(task.id)
      setTasks((prev) => prev.filter((t) => t.id !== task.id))
    } catch (err) {
      setError(err?.message ?? 'Could not delete the task.')
    } finally {
      setPendingId(null)
    }
  }

  const progress = useMemo(() => {
    const total = tasks.length
    const done = tasks.filter((t) => t.done).length
    return { total, done }
  }, [tasks])

  return (
    <AdminLayout>
      <header className="mb-6">
        <p className="m-0 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
          Recruitment
        </p>
        <h1 className="m-0 mt-2 text-[2rem] font-bold leading-[1.1] tracking-[-0.01em] text-[#0F1419] max-[600px]:text-[1.6rem]">
          Onboarding checklist
        </h1>
        <p className="mb-0 mt-2 text-[0.95rem] leading-snug text-[#4A5568]">
          Track a new hire's onboarding tasks. Pick an employee to begin.
        </p>
      </header>

      {missing ? (
        <div className="rounded-[16px] border border-amber-200 bg-amber-50/60 p-5">
          <p className="m-0 text-[0.95rem] font-semibold text-[#0F1419]">Onboarding tasks table not found.</p>
          <p className="m-0 mt-1 text-[0.85rem] text-[#4A5568]">
            Run{' '}
            <span className="[font-family:'Geist_Mono',monospace]">
              supabase/migrations/019_create_onboarding_tasks.sql
            </span>{' '}
            in the Supabase SQL Editor, then reload this page.
          </p>
        </div>
      ) : (
        <>
          {/* Employee picker */}
          <div className="flex flex-wrap items-center gap-2 rounded-[12px] border border-slate-200 bg-white p-2 shadow-[0_8px_24px_rgba(15,20,25,0.04)]">
            <label className="flex flex-1 items-center gap-2 px-1">
              <span className="text-[0.7rem] font-medium uppercase tracking-[0.1em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
                Employee
              </span>
              <select
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                aria-label="Select employee"
                className="h-9 flex-1 rounded-[8px] border border-slate-200 bg-white px-2 text-[0.85rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:ring-2 focus:ring-[#2C5EF5]/20"
              >
                <option value="">— Select an employee —</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.profile?.full_name ?? 'Unnamed'} ({emp.employee_number})
                  </option>
                ))}
              </select>
            </label>
            {employeeId && progress.total > 0 ? (
              <span
                className="rounded-[8px] bg-[#F1F3F5] px-2.5 py-1.5 text-[0.75rem] font-medium text-[#4A5568] [font-family:'Geist_Mono',monospace]"
                aria-label="Onboarding progress"
              >
                {progress.done}/{progress.total} done
              </span>
            ) : null}
          </div>

          {error ? (
            <p className="mt-4 rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-[0.85rem] text-red-700">
              {error}
            </p>
          ) : null}

          {!employeeId ? (
            <div className="mt-4 rounded-[16px] border border-dashed border-slate-200 bg-slate-50/40 px-4 py-12 text-center">
              <p className="m-0 text-[0.95rem] font-semibold text-[#0F1419]">No employee selected.</p>
              <p className="m-0 mt-1 text-[0.85rem] text-[#4A5568]">
                Choose someone above to see and manage their onboarding tasks.
              </p>
            </div>
          ) : (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="mt-4 rounded-[16px] border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,20,25,0.04)]"
              aria-label="Onboarding tasks"
            >
              {/* Add a task */}
              <form onSubmit={handleAdd} className="mb-4 flex gap-2">
                <input
                  type="text"
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  placeholder="Add a task, e.g. Sign contract"
                  aria-label="New onboarding task"
                  className="h-9 flex-1 rounded-[8px] border border-slate-200 bg-white px-3 text-[0.9rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:ring-2 focus:ring-[#2C5EF5]/20"
                />
                <button
                  type="submit"
                  disabled={adding || !newTask.trim()}
                  className="inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-[#2C5EF5] px-3 text-[0.8rem] font-semibold text-white transition-colors hover:bg-[#1E47C9] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Plus size={14} strokeWidth={2.5} aria-hidden="true" />
                  Add
                </button>
              </form>

              {loading && tasks.length === 0 ? (
                <p className="py-6 text-center text-[0.85rem] text-[#4A5568]">Loading tasks…</p>
              ) : tasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-1 py-10 text-center">
                  <ClipboardList size={22} strokeWidth={1.75} className="text-[#94A3B8]" aria-hidden="true" />
                  <p className="m-0 mt-1 text-[0.95rem] font-semibold text-[#0F1419]">No tasks yet.</p>
                  <p className="m-0 text-[0.85rem] text-[#4A5568]">
                    Add the steps this new hire needs to complete.
                  </p>
                </div>
              ) : (
                <ul className="m-0 flex flex-col gap-2 p-0">
                  {tasks.map((t) => {
                    const busy = pendingId === t.id
                    return (
                      <li
                        key={t.id}
                        className="flex items-center gap-3 rounded-[10px] border border-slate-200 px-3 py-2.5"
                      >
                        <input
                          type="checkbox"
                          checked={t.done}
                          disabled={busy}
                          onChange={() => handleToggle(t)}
                          aria-label={`Mark "${t.task}" ${t.done ? 'not done' : 'done'}`}
                          className="h-4 w-4 shrink-0 cursor-pointer accent-[#2C5EF5] disabled:cursor-not-allowed"
                        />
                        <span
                          className={`flex-1 text-[0.9rem] ${
                            t.done ? 'text-[#94A3B8] line-through' : 'text-[#0F1419]'
                          }`}
                        >
                          {t.task}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDelete(t)}
                          disabled={busy}
                          aria-label={`Delete "${t.task}"`}
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-[#4A5568] transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Trash2 size={14} strokeWidth={2} />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </motion.section>
          )}
        </>
      )}
    </AdminLayout>
  )
}

export default OnboardingChecklist
