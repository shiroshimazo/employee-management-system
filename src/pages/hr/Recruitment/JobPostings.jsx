import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, Briefcase, Pencil, Plus, Trash2 } from 'lucide-react'
import AdminLayout from '../../../layouts/AdminLayout.jsx'
import StatusBadge from '../../../components/common/StatusBadge.jsx'
import Modal from '../../../components/common/Modal/Modal.jsx'
import { LoadingButtonLabel, LoadingState } from '../../../components/common/LoadingBars.jsx'
import {
  createJobPosting,
  deleteJobPosting,
  getJobPostings,
  updateJobPosting,
} from '../../../services/jobPosting.service.js'
import { getDepartments } from '../../../services/department.service.js'

/**
 * JobPostings — open roles for the HR Recruitment panel.
 *
 * Backed by jobPosting.service / the job_postings table. Admin/HR maintain
 * postings; everyone can read. If the 017 migration hasn't been run, the table
 * is absent — we detect that and show a hint instead of a broken page.
 */

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
  { value: 'draft', label: 'Draft' },
]

const STATUS_FORM = [
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
  { value: 'draft', label: 'Draft' },
]

const EMPLOYMENT_TYPES = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'intern', label: 'Intern' },
]

function isMissingTableError(err) {
  const msg = (err?.message ?? '').toLowerCase()
  return (
    err?.code === '42P01' ||
    err?.code === 'PGRST205' ||
    (msg.includes('job_postings') && msg.includes('does not exist')) ||
    msg.includes('could not find the table')
  )
}

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function JobPostings() {
  const [rows, setRows] = useState([])
  const [departments, setDepartments] = useState([])
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
      const { data } = await getJobPostings({ status: status || undefined })
      if (token !== reqTokenRef.current) return
      setRows(data ?? [])
    } catch (err) {
      if (token !== reqTokenRef.current) return
      if (isMissingTableError(err)) {
        setMissing(true)
      } else {
        setError(err?.message ?? 'Failed to load job postings.')
      }
      setRows([])
    } finally {
      if (token === reqTokenRef.current) setLoading(false)
    }
  }, [status])

  // Defer the load out of the synchronous effect body — same pattern the
  // other admin pages use to keep setState off the render path.
  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  // Departments are stable across filter changes — load once for the dropdown.
  useEffect(() => {
    let alive = true
    getDepartments()
      .then((res) => alive && setDepartments(res?.data ?? []))
      .catch(() => alive && setDepartments([]))
    return () => {
      alive = false
    }
  }, [])

  async function handleCreate(payload) {
    await createJobPosting(payload)
    await load()
  }

  async function handleUpdate(payload) {
    await updateJobPosting(editTarget.id, payload)
    await load()
  }

  async function handleDelete(posting) {
    await deleteJobPosting(posting.id)
    setRows((prev) => prev.filter((r) => r.id !== posting.id))
  }

  const totalLabel = useMemo(() => {
    if (loading) {
      return <LoadingState label="Loading" barsClassName="h-3 w-5" />
    }
    return `${rows.length} ${rows.length === 1 ? 'posting' : 'postings'}`
  }, [loading, rows.length])

  return (
    <AdminLayout>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="m-0 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
            Recruitment
          </p>
          <h1 className="m-0 mt-2 text-[2rem] font-bold leading-[1.1] tracking-[-0.01em] text-[#0F1419] max-[600px]:text-[1.6rem]">
            Job postings
          </h1>
          <p className="mb-0 mt-2 text-[0.95rem] leading-snug text-[#4A5568]">
            Roles the organization is hiring for.
          </p>
        </div>
        <span
          className="inline-flex items-center gap-2 rounded-[10px] bg-white px-3 py-2 text-[0.75rem] font-medium text-[#4A5568] shadow-[0_4px_12px_rgba(15,20,25,0.04)] [font-family:'Geist_Mono',monospace]"
          aria-label="Total job postings"
        >
          <Briefcase size={12} strokeWidth={2.25} aria-hidden="true" />
          {totalLabel}
        </span>
      </header>

      {missing ? (
        <div className="rounded-[16px] border border-amber-200 bg-amber-50/60 p-5">
          <p className="m-0 text-[0.95rem] font-semibold text-[#0F1419]">Job postings table not found.</p>
          <p className="m-0 mt-1 text-[0.85rem] text-[#4A5568]">
            Run{' '}
            <span className="[font-family:'Geist_Mono',monospace]">
              supabase/migrations/017_create_job_postings.sql
            </span>{' '}
            in the Supabase SQL Editor, then reload this page.
          </p>
        </div>
      ) : (
        <>
          {/* Toolbar: status filter + add */}
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
              Add posting
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
            aria-label="Job postings"
          >
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-left">
                    {['Role', 'Department', 'Location', 'Type', 'Status', 'Posted', ''].map((h, i) => (
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
                        <LoadingState label="Loading job postings" />
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center">
                        <p className="m-0 text-[0.95rem] font-semibold text-[#0F1419]">
                          No job postings yet.
                        </p>
                        <p className="m-0 mt-1 text-[0.85rem] text-[#4A5568]">
                          Add a role to start tracking applicants against it.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => (
                      <tr key={r.id} className="transition-colors hover:bg-slate-50/60">
                        <td className="px-4 py-3 text-[0.9rem] font-medium text-[#0F1419]">
                          {r.title}
                        </td>
                        <td className="px-4 py-3 text-[0.85rem] text-[#4A5568]">
                          {r.department?.name ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-[0.85rem] text-[#4A5568]">
                          {r.location ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge value={r.employment_type} />
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge value={r.status} />
                        </td>
                        <td className="px-4 py-3 text-[0.8rem] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
                          {formatDate(r.created_at)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setEditTarget(r)}
                              aria-label={`Edit ${r.title}`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-[#4A5568] transition-colors hover:bg-slate-100 hover:text-[#0F1419]"
                            >
                              <Pencil size={14} strokeWidth={2} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(r)}
                              aria-label={`Delete ${r.title}`}
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

          <JobPostingModal
            open={createOpen}
            onClose={() => setCreateOpen(false)}
            mode="create"
            departments={departments}
            onSubmit={handleCreate}
          />
          <JobPostingModal
            open={Boolean(editTarget)}
            onClose={() => setEditTarget(null)}
            mode="edit"
            initialValue={editTarget}
            departments={departments}
            onSubmit={handleUpdate}
          />
          <DeletePostingModal
            open={Boolean(deleteTarget)}
            onClose={() => setDeleteTarget(null)}
            posting={deleteTarget}
            onConfirm={handleDelete}
          />
        </>
      )}
    </AdminLayout>
  )
}

const EMPTY = {
  title: '',
  department_id: '',
  location: '',
  employment_type: 'full_time',
  status: 'open',
  description: '',
}

function fromPosting(row) {
  if (!row) return { ...EMPTY }
  return {
    title: row.title ?? '',
    department_id: row.department?.id ?? '',
    location: row.location ?? '',
    employment_type: row.employment_type ?? 'full_time',
    status: row.status ?? 'open',
    description: row.description ?? '',
  }
}

function JobPostingModal({ open, onClose, mode = 'create', initialValue, departments = [], onSubmit }) {
  const [form, setForm] = useState(() => fromPosting(initialValue))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  // Reset whenever the modal opens or the edited row changes.
  useEffect(() => {
    if (!open) return
    setForm(fromPosting(initialValue))
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
        title: form.title.trim(),
        department_id: form.department_id || null,
        location: form.location.trim() || null,
        employment_type: form.employment_type,
        status: form.status,
        description: form.description.trim() || null,
      })
      onClose?.()
    } catch (err) {
      setError(err?.message ?? 'Something went wrong saving the posting.')
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
      title={isEdit ? 'Edit job posting' : 'Add job posting'}
      description={isEdit ? 'Update the role details.' : 'Open a role for applicants.'}
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
            form="job-posting-form"
            disabled={submitting}
            className="inline-flex h-9 items-center rounded-[8px] bg-[#2C5EF5] px-3 text-[0.8rem] font-semibold text-white transition-colors hover:bg-[#1E47C9] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <LoadingButtonLabel label="Saving" />
            ) : isEdit ? (
              'Save changes'
            ) : (
              'Create posting'
            )}
          </button>
        </>
      }
    >
      <form id="job-posting-form" onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
        <Field label="Title" required className="col-span-2">
          <input
            type="text"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            required
            placeholder="e.g. Senior Backend Engineer"
            className="h-10 w-full rounded-[8px] border border-slate-200 bg-white px-3 text-[0.9rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:ring-2 focus:ring-[#2C5EF5]/20"
          />
        </Field>

        <Field label="Department">
          <select
            value={form.department_id}
            onChange={(e) => set('department_id', e.target.value)}
            className="h-10 w-full rounded-[8px] border border-slate-200 bg-white px-3 text-[0.9rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:ring-2 focus:ring-[#2C5EF5]/20"
          >
            <option value="">— Unassigned —</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Location">
          <input
            type="text"
            value={form.location}
            onChange={(e) => set('location', e.target.value)}
            placeholder="e.g. Remote / Manila"
            className="h-10 w-full rounded-[8px] border border-slate-200 bg-white px-3 text-[0.9rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:ring-2 focus:ring-[#2C5EF5]/20"
          />
        </Field>

        <Field label="Employment type">
          <select
            value={form.employment_type}
            onChange={(e) => set('employment_type', e.target.value)}
            className="h-10 w-full rounded-[8px] border border-slate-200 bg-white px-3 text-[0.9rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:ring-2 focus:ring-[#2C5EF5]/20"
          >
            {EMPLOYMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Status">
          <select
            value={form.status}
            onChange={(e) => set('status', e.target.value)}
            className="h-10 w-full rounded-[8px] border border-slate-200 bg-white px-3 text-[0.9rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:ring-2 focus:ring-[#2C5EF5]/20"
          >
            {STATUS_FORM.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Description" className="col-span-2">
          <textarea
            rows={4}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Responsibilities, requirements, etc."
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

function DeletePostingModal({ open, onClose, posting, onConfirm }) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  async function handleConfirm() {
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm(posting)
      onClose?.()
    } catch (err) {
      setError(err?.message ?? 'Could not delete this posting.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onClose}
      size="sm"
      title="Delete job posting"
      description="Applicants on this posting are kept, but lose their link to it."
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
            disabled={submitting || !posting}
            className="inline-flex h-9 items-center rounded-[8px] bg-red-600 px-3 text-[0.8rem] font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? <LoadingButtonLabel label="Deleting" /> : 'Delete posting'}
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
          Delete <span className="font-semibold">{posting?.title ?? 'this posting'}</span>?
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

export default JobPostings
