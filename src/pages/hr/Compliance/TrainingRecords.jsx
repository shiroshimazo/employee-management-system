import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, GraduationCap, Pencil, Plus, Trash2 } from 'lucide-react'
import AdminLayout from '../../../layouts/AdminLayout.jsx'
import StatusBadge from '../../../components/common/StatusBadge.jsx'
import Modal from '../../../components/common/Modal/Modal.jsx'
import { LoadingButtonLabel, LoadingState } from '../../../components/common/LoadingBars.jsx'
import {
  TRAINING_STATUSES,
  createTrainingRecord,
  deleteTrainingRecord,
  getTrainingRecords,
  updateTrainingRecord,
} from '../../../services/training.service.js'
import { getEmployees } from '../../../services/employee.service.js'

/**
 * TrainingRecords — employee training / certification log (HR Compliance).
 *
 * Backed by training.service / the training_records table. HR manages;
 * everyone's own is readable. If the 021 migration hasn't been run, the table
 * is absent — we detect that and show a hint instead of a broken page.
 */

const STATUS_OPTIONS = [{ value: '', label: 'All statuses' }, ...TRAINING_STATUSES]

function isMissingTableError(err) {
  const msg = (err?.message ?? '').toLowerCase()
  return (
    err?.code === '42P01' ||
    err?.code === 'PGRST205' ||
    (msg.includes('training_records') && msg.includes('does not exist')) ||
    msg.includes('could not find the table')
  )
}

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function TrainingRecords() {
  const [rows, setRows] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [missing, setMissing] = useState(false)

  const [status, setStatus] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const reqTokenRef = useRef(0)

  const load = useCallback(async () => {
    const token = ++reqTokenRef.current
    setLoading(true)
    setError(null)
    try {
      const { data } = await getTrainingRecords({ status: status || undefined })
      if (token !== reqTokenRef.current) return
      setRows(data ?? [])
    } catch (err) {
      if (token !== reqTokenRef.current) return
      if (isMissingTableError(err)) {
        setMissing(true)
      } else {
        setError(err?.message ?? 'Failed to load training records.')
      }
      setRows([])
    } finally {
      if (token === reqTokenRef.current) setLoading(false)
    }
  }, [status])

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  useEffect(() => {
    let alive = true
    getEmployees({ limit: 500 })
      .then((res) => alive && setEmployees(res?.data ?? []))
      .catch(() => alive && setEmployees([]))
    return () => {
      alive = false
    }
  }, [])

  async function handleCreate(payload) {
    await createTrainingRecord(payload)
    await load()
  }

  async function handleUpdate(payload) {
    await updateTrainingRecord(editTarget.id, payload)
    await load()
  }

  async function handleDelete(record) {
    await deleteTrainingRecord(record.id)
    setRows((prev) => prev.filter((r) => r.id !== record.id))
  }

  const totalLabel = useMemo(() => {
    if (loading) {
      return <LoadingState label="Loading" barsClassName="h-3 w-5" />
    }
    return `${rows.length} ${rows.length === 1 ? 'record' : 'records'}`
  }, [loading, rows.length])

  return (
    <AdminLayout>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="m-0 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
            Compliance
          </p>
          <h1 className="m-0 mt-2 text-[2rem] font-bold leading-[1.1] tracking-[-0.01em] text-[#0F1419] max-[600px]:text-[1.6rem]">
            Training records
          </h1>
          <p className="mb-0 mt-2 text-[0.95rem] leading-snug text-[#4A5568]">
            Courses and certifications across the organization, and what's expiring.
          </p>
        </div>
        <span
          className="inline-flex items-center gap-2 rounded-[10px] bg-white px-3 py-2 text-[0.75rem] font-medium text-[#4A5568] shadow-[0_4px_12px_rgba(15,20,25,0.04)] [font-family:'Geist_Mono',monospace]"
          aria-label="Total training records"
        >
          <GraduationCap size={12} strokeWidth={2.25} aria-hidden="true" />
          {totalLabel}
        </span>
      </header>

      {missing ? (
        <div className="rounded-[16px] border border-amber-200 bg-amber-50/60 p-5">
          <p className="m-0 text-[0.95rem] font-semibold text-[#0F1419]">Training records table not found.</p>
          <p className="m-0 mt-1 text-[0.85rem] text-[#4A5568]">
            Run{' '}
            <span className="[font-family:'Geist_Mono',monospace]">
              supabase/migrations/021_create_training_records.sql
            </span>{' '}
            in the Supabase SQL Editor, then reload this page.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 rounded-[12px] border border-slate-200 bg-white p-2 shadow-[0_8px_24px_rgba(15,20,25,0.04)]">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-label="Filter by status"
              className="h-9 rounded-[8px] border border-slate-200 bg-white px-2 text-[0.85rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:ring-2 focus:ring-[#2C5EF5]/20"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-[#2C5EF5] px-3 text-[0.8rem] font-semibold text-white transition-colors hover:bg-[#1E47C9]"
            >
              <Plus size={14} strokeWidth={2.5} aria-hidden="true" />
              Add record
            </button>
          </div>

          {error ? (
            <p className="mt-4 rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-[0.85rem] text-red-700">
              {error}
            </p>
          ) : null}

          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="mt-4 overflow-hidden rounded-[16px] border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,20,25,0.04)]"
            aria-label="Training records"
          >
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-left">
                    {['Employee', 'Course', 'Provider', 'Completed', 'Expires', 'Status', ''].map((h, i) => (
                      <th
                        key={i}
                        className="border-b border-slate-200 bg-slate-50/60 px-4 py-3 text-[0.65rem] font-medium uppercase tracking-[0.1em] text-[#4A5568] [font-family:'Geist_Mono',monospace]"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading && rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-[0.85rem] text-[#4A5568]">
                        <LoadingState label="Loading training records" />
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center">
                        <p className="m-0 text-[0.95rem] font-semibold text-[#0F1419]">
                          No training records match.
                        </p>
                        <p className="m-0 mt-1 text-[0.85rem] text-[#4A5568]">
                          Try clearing the filter, or add a record.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => (
                      <tr key={r.id} className="transition-colors hover:bg-slate-50/60">
                        <td className="px-4 py-3">
                          <p className="m-0 text-[0.9rem] font-medium text-[#0F1419]">
                            {r.employee?.profile?.full_name ?? 'Unknown'}
                          </p>
                          <p className="m-0 text-[0.75rem] text-[#94A3B8] [font-family:'Geist_Mono',monospace]">
                            {r.employee?.employee_number ?? '—'}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-[0.9rem] font-medium text-[#0F1419]">
                          {r.course}
                        </td>
                        <td className="px-4 py-3 text-[0.85rem] text-[#4A5568]">
                          {r.provider ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-[0.8rem] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
                          {formatDate(r.completed_date)}
                        </td>
                        <td className="px-4 py-3 text-[0.8rem] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
                          {formatDate(r.expiry_date)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge value={r.status} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setEditTarget(r)}
                              aria-label={`Edit ${r.course}`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-[#4A5568] transition-colors hover:bg-slate-100 hover:text-[#0F1419]"
                            >
                              <Pencil size={14} strokeWidth={2} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(r)}
                              aria-label={`Delete ${r.course}`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-[#4A5568] transition-colors hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 size={14} strokeWidth={2} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </motion.section>

          <TrainingModal
            open={createOpen}
            onClose={() => setCreateOpen(false)}
            mode="create"
            employees={employees}
            onSubmit={handleCreate}
          />
          <TrainingModal
            open={Boolean(editTarget)}
            onClose={() => setEditTarget(null)}
            mode="edit"
            initialValue={editTarget}
            employees={employees}
            onSubmit={handleUpdate}
          />
          <DeleteTrainingModal
            open={Boolean(deleteTarget)}
            onClose={() => setDeleteTarget(null)}
            record={deleteTarget}
            onConfirm={handleDelete}
          />
        </>
      )}
    </AdminLayout>
  )
}

const EMPTY = {
  employee_id: '',
  course: '',
  provider: '',
  completed_date: '',
  expiry_date: '',
  status: 'completed',
  notes: '',
}

function fromRecord(row) {
  if (!row) return { ...EMPTY }
  return {
    employee_id: row.employee?.id ?? row.employee_id ?? '',
    course: row.course ?? '',
    provider: row.provider ?? '',
    completed_date: row.completed_date ?? '',
    expiry_date: row.expiry_date ?? '',
    status: row.status ?? 'completed',
    notes: row.notes ?? '',
  }
}

function TrainingModal({ open, onClose, mode = 'create', initialValue, employees = [], onSubmit }) {
  const [form, setForm] = useState(() => fromRecord(initialValue))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open) return
    setForm(fromRecord(initialValue))
    setError(null)
  }, [open, initialValue])

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        employee_id: form.employee_id || undefined,
        course: form.course.trim(),
        provider: form.provider.trim() || null,
        completed_date: form.completed_date || null,
        expiry_date: form.expiry_date || null,
        status: form.status,
        notes: form.notes.trim() || null,
      })
      onClose?.()
    } catch (err) {
      setError(err?.message ?? 'Could not save the training record.')
    } finally {
      setSubmitting(false)
    }
  }

  const isEdit = mode === 'edit'

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onClose}
      size="lg"
      title={isEdit ? 'Edit training record' : 'Add training record'}
      description={isEdit ? 'Update the training details.' : 'Log a course or certification.'}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="inline-flex h-9 items-center rounded-[8px] border border-slate-200 bg-white px-3 text-[0.8rem] font-medium text-[#4A5568] transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="training-form"
            disabled={submitting}
            className="inline-flex h-9 items-center rounded-[8px] bg-[#2C5EF5] px-3 text-[0.8rem] font-semibold text-white transition-colors hover:bg-[#1E47C9] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <LoadingButtonLabel label="Saving" />
            ) : isEdit ? (
              'Save changes'
            ) : (
              'Create record'
            )}
          </button>
        </>
      }
    >
      <form id="training-form" onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
        <Field label="Employee" required className="col-span-2">
          <select
            value={form.employee_id}
            onChange={(e) => set('employee_id', e.target.value)}
            required
            disabled={isEdit}
            className="h-10 w-full rounded-[8px] border border-slate-200 bg-white px-3 text-[0.9rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:ring-2 focus:ring-[#2C5EF5]/20 disabled:bg-slate-50 disabled:text-[#94A3B8]"
          >
            <option value="">— Select employee —</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.profile?.full_name ?? 'Unnamed'} ({emp.employee_number})
              </option>
            ))}
          </select>
        </Field>

        <Field label="Course" required>
          <input
            type="text"
            value={form.course}
            onChange={(e) => set('course', e.target.value)}
            required
            placeholder="e.g. Workplace Safety"
            className="h-10 w-full rounded-[8px] border border-slate-200 bg-white px-3 text-[0.9rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:ring-2 focus:ring-[#2C5EF5]/20"
          />
        </Field>

        <Field label="Provider">
          <input
            type="text"
            value={form.provider}
            onChange={(e) => set('provider', e.target.value)}
            placeholder="e.g. Coursera"
            className="h-10 w-full rounded-[8px] border border-slate-200 bg-white px-3 text-[0.9rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:ring-2 focus:ring-[#2C5EF5]/20"
          />
        </Field>

        <Field label="Completed date">
          <input
            type="date"
            value={form.completed_date}
            onChange={(e) => set('completed_date', e.target.value)}
            className="h-10 w-full rounded-[8px] border border-slate-200 bg-white px-3 text-[0.9rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:ring-2 focus:ring-[#2C5EF5]/20"
          />
        </Field>

        <Field label="Expiry date">
          <input
            type="date"
            value={form.expiry_date}
            onChange={(e) => set('expiry_date', e.target.value)}
            className="h-10 w-full rounded-[8px] border border-slate-200 bg-white px-3 text-[0.9rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:ring-2 focus:ring-[#2C5EF5]/20"
          />
        </Field>

        <Field label="Status">
          <select
            value={form.status}
            onChange={(e) => set('status', e.target.value)}
            className="h-10 w-full rounded-[8px] border border-slate-200 bg-white px-3 text-[0.9rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:ring-2 focus:ring-[#2C5EF5]/20"
          >
            {TRAINING_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Notes" className="col-span-2">
          <textarea
            rows={2}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Optional context…"
            className="rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-[0.9rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:ring-2 focus:ring-[#2C5EF5]/20"
          />
        </Field>

        {error ? (
          <p className="col-span-2 m-0 rounded-[8px] bg-red-50 px-3 py-2 text-[0.8rem] text-red-700">
            {error}
          </p>
        ) : null}
      </form>
    </Modal>
  )
}

function DeleteTrainingModal({ open, onClose, record, onConfirm }) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  async function handleConfirm() {
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm(record)
      onClose?.()
    } catch (err) {
      setError(err?.message ?? 'Could not delete this record.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onClose}
      size="sm"
      title="Delete training record"
      description="This removes the training record."
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="inline-flex h-9 items-center rounded-[8px] border border-slate-200 bg-white px-3 text-[0.8rem] font-medium text-[#4A5568] transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting || !record}
            className="inline-flex h-9 items-center rounded-[8px] bg-red-600 px-3 text-[0.8rem] font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? <LoadingButtonLabel label="Deleting" /> : 'Delete record'}
          </button>
        </>
      }
    >
      <div className="flex items-start gap-3 rounded-[10px] border border-red-100 bg-red-50/60 p-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700"
          aria-hidden="true"
        >
          <AlertTriangle size={16} strokeWidth={2.25} />
        </span>
        <p className="m-0 text-[0.9rem] text-[#0F1419]">
          Delete <span className="font-semibold">{record?.course ?? 'this record'}</span> for{' '}
          {record?.employee?.profile?.full_name ?? 'this employee'}?
        </p>
      </div>

      {error ? (
        <p className="m-0 mt-3 rounded-[8px] bg-red-50 px-3 py-2 text-[0.8rem] text-red-700">
          {error}
        </p>
      ) : null}
    </Modal>
  )
}

function Field({ label, required, className = '', children }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-[0.7rem] font-medium uppercase tracking-[0.1em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
        {label}
        {required ? <span className="ml-1 text-red-500">*</span> : null}
      </span>
      {children}
    </label>
  )
}

export default TrainingRecords
