import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, ExternalLink, Plus, Trash2, UserSearch } from 'lucide-react'
import AdminLayout from '../../../layouts/AdminLayout.jsx'
import Modal from '../../../components/common/Modal/Modal.jsx'
import { LoadingButtonLabel, LoadingState } from '../../../components/common/LoadingBars.jsx'
import {
  STAGES,
  createApplicant,
  deleteApplicant,
  getApplicants,
  updateApplicantStage,
} from '../../../services/applicant.service.js'
import { getJobPostings } from '../../../services/jobPosting.service.js'

/**
 * Applicants — candidates in the hiring pipeline (HR Recruitment panel).
 *
 * Backed by applicant.service / the applicants table (HR only). If the
 * 018 migration hasn't been run, the table is absent — we detect that and show
 * a hint instead of a broken page.
 *
 * Stage can be changed inline. Note: setting 'Hired' only moves the candidate
 * through the pipeline — it does NOT create an employee record (the anon key
 * can't provision auth users).
 */

const STAGE_OPTIONS = [{ value: '', label: 'All stages' }, ...STAGES]

function isMissingTableError(err) {
  const msg = (err?.message ?? '').toLowerCase()
  return (
    err?.code === '42P01' ||
    err?.code === 'PGRST205' ||
    (msg.includes('applicants') && msg.includes('does not exist')) ||
    msg.includes('could not find the table')
  )
}

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function Applicants() {
  const [rows, setRows] = useState([])
  const [postings, setPostings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [missing, setMissing] = useState(false)

  // Toolbar state
  const [stage, setStage] = useState('')
  const [jobPostingId, setJobPostingId] = useState('')

  // Per-row pending flag so a stage <select> disables while saving.
  const [pendingId, setPendingId] = useState(null)

  const [addOpen, setAddOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const reqTokenRef = useRef(0)

  const load = useCallback(async () => {
    const token = ++reqTokenRef.current
    setLoading(true)
    setError(null)
    try {
      const { data } = await getApplicants({
        stage: stage || undefined,
        jobPostingId: jobPostingId || undefined,
      })
      if (token !== reqTokenRef.current) return
      setRows(data ?? [])
    } catch (err) {
      if (token !== reqTokenRef.current) return
      if (isMissingTableError(err)) {
        setMissing(true)
      } else {
        setError(err?.message ?? 'Failed to load applicants.')
      }
      setRows([])
    } finally {
      if (token === reqTokenRef.current) setLoading(false)
    }
  }, [stage, jobPostingId])

  // Defer the load out of the synchronous effect body — same pattern the
  // other admin pages use to keep setState off the render path.
  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  // Job postings for the filter + add-modal dropdown — load once.
  useEffect(() => {
    let alive = true
    getJobPostings()
      .then((res) => alive && setPostings(res?.data ?? []))
      .catch(() => alive && setPostings([]))
    return () => {
      alive = false
    }
  }, [])

  async function handleCreate(payload) {
    await createApplicant(payload)
    await load()
  }

  async function handleStageChange(row, nextStage) {
    setPendingId(row.id)
    setError(null)
    try {
      const updated = await updateApplicantStage(row.id, nextStage)
      setRows((prev) => prev.map((r) => (r.id === row.id ? updated : r)))
    } catch (err) {
      setError(err?.message ?? 'Could not update the stage.')
    } finally {
      setPendingId(null)
    }
  }

  async function handleDelete(applicant) {
    await deleteApplicant(applicant.id)
    setRows((prev) => prev.filter((r) => r.id !== applicant.id))
  }

  const totalLabel = useMemo(() => {
    if (loading) {
      return <LoadingState label="Loading" barsClassName="h-3 w-5" />
    }
    return `${rows.length} ${rows.length === 1 ? 'applicant' : 'applicants'}`
  }, [loading, rows.length])

  return (
    <AdminLayout>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="m-0 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
            Recruitment
          </p>
          <h1 className="m-0 mt-2 text-[2rem] font-bold leading-[1.1] tracking-[-0.01em] text-[#0F1419] max-[600px]:text-[1.6rem]">
            Applicants
          </h1>
          <p className="mb-0 mt-2 text-[0.95rem] leading-snug text-[#4A5568]">
            Candidates moving through the hiring pipeline.
          </p>
        </div>
        <span
          className="inline-flex items-center gap-2 rounded-[10px] bg-white px-3 py-2 text-[0.75rem] font-medium text-[#4A5568] shadow-[0_4px_12px_rgba(15,20,25,0.04)] [font-family:'Geist_Mono',monospace]"
          aria-label="Total applicants"
        >
          <UserSearch size={12} strokeWidth={2.25} aria-hidden="true" />
          {totalLabel}
        </span>
      </header>

      {missing ? (
        <div className="rounded-[16px] border border-amber-200 bg-amber-50/60 p-5">
          <p className="m-0 text-[0.95rem] font-semibold text-[#0F1419]">Applicants table not found.</p>
          <p className="m-0 mt-1 text-[0.85rem] text-[#4A5568]">
            Run{' '}
            <span className="[font-family:'Geist_Mono',monospace]">
              supabase/migrations/018_create_applicants.sql
            </span>{' '}
            in the Supabase SQL Editor, then reload this page.
          </p>
        </div>
      ) : (
        <>
          {/* Toolbar: stage + job filters + add */}
          <div className="flex flex-wrap items-center gap-2 rounded-[12px] border border-slate-200 bg-white p-2 shadow-[0_8px_24px_rgba(15,20,25,0.04)]">
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value)}
              aria-label="Filter by stage"
              className="h-9 rounded-[8px] border border-slate-200 bg-white px-2 text-[0.85rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:ring-2 focus:ring-[#2C5EF5]/20"
            >
              {STAGE_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>

            <select
              value={jobPostingId}
              onChange={(e) => setJobPostingId(e.target.value)}
              aria-label="Filter by job posting"
              className="h-9 max-w-[220px] rounded-[8px] border border-slate-200 bg-white px-2 text-[0.85rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:ring-2 focus:ring-[#2C5EF5]/20"
            >
              <option value="">All postings</option>
              {postings.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-[#2C5EF5] px-3 text-[0.8rem] font-semibold text-white transition-colors hover:bg-[#1E47C9]"
            >
              <Plus size={14} strokeWidth={2.5} aria-hidden="true" />
              Add applicant
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
            aria-label="Applicants"
          >
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-left">
                    {['Candidate', 'Applied for', 'Resume', 'Stage', 'Applied', ''].map((h, i) => (
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
                      <td colSpan={6} className="px-4 py-10 text-center text-[0.85rem] text-[#4A5568]">
                        <LoadingState label="Loading applicants" />
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center">
                        <p className="m-0 text-[0.95rem] font-semibold text-[#0F1419]">
                          No applicants match.
                        </p>
                        <p className="m-0 mt-1 text-[0.85rem] text-[#4A5568]">
                          Try clearing filters, or add a candidate.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => {
                      const busy = pendingId === r.id
                      return (
                        <tr key={r.id} className="transition-colors hover:bg-slate-50/60">
                          <td className="px-4 py-3">
                            <p className="m-0 text-[0.9rem] font-medium text-[#0F1419]">{r.name}</p>
                            <p className="m-0 text-[0.75rem] text-[#94A3B8]">
                              {r.email ?? r.phone ?? '—'}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-[0.85rem] text-[#4A5568]">
                            {r.posting?.title ?? '—'}
                          </td>
                          <td className="px-4 py-3">
                            {r.resume_url ? (
                              <a
                                href={r.resume_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[0.8rem] font-medium text-[#2C5EF5] hover:underline"
                              >
                                View
                                <ExternalLink size={12} strokeWidth={2} aria-hidden="true" />
                              </a>
                            ) : (
                              <span className="text-[0.8rem] text-[#94A3B8]">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={r.stage}
                              onChange={(e) => handleStageChange(r, e.target.value)}
                              disabled={busy}
                              aria-label={`Stage for ${r.name}`}
                              className="h-8 rounded-[8px] border border-slate-200 bg-white px-2 text-[0.78rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:ring-2 focus:ring-[#2C5EF5]/20 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {STAGES.map((s) => (
                                <option key={s.value} value={s.value}>
                                  {s.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3 text-[0.8rem] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
                            {formatDate(r.created_at)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(r)}
                              aria-label={`Delete ${r.name}`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-[#4A5568] transition-colors hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 size={14} strokeWidth={2} />
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </motion.section>

          {/* Hiring doesn't auto-create staff — make that explicit. */}
          <p className="mt-3 text-[0.78rem] text-[#94A3B8]">
            Setting a candidate to “Hired” updates their stage only — it doesn’t create an
            employee record.
          </p>

          <AddApplicantModal
            open={addOpen}
            onClose={() => setAddOpen(false)}
            postings={postings}
            onSubmit={handleCreate}
          />
          <DeleteApplicantModal
            open={Boolean(deleteTarget)}
            onClose={() => setDeleteTarget(null)}
            applicant={deleteTarget}
            onConfirm={handleDelete}
          />
        </>
      )}
    </AdminLayout>
  )
}

const EMPTY = {
  name: '',
  email: '',
  phone: '',
  job_posting_id: '',
  resume_url: '',
  notes: '',
}

function AddApplicantModal({ open, onClose, postings = [], onSubmit }) {
  const [form, setForm] = useState(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open) return
    setForm(EMPTY)
    setError(null)
  }, [open])

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        job_posting_id: form.job_posting_id || null,
        resume_url: form.resume_url.trim() || null,
        notes: form.notes.trim() || null,
      })
      onClose?.()
    } catch (err) {
      setError(err?.message ?? 'Could not save the applicant.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onClose}
      size="md"
      title="Add applicant"
      description="Add a candidate to the pipeline. New applicants start at “Applied”."
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
            form="add-applicant-form"
            disabled={submitting}
            className="inline-flex h-9 items-center rounded-[8px] bg-[#2C5EF5] px-3 text-[0.8rem] font-semibold text-white transition-colors hover:bg-[#1E47C9] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? <LoadingButtonLabel label="Saving" /> : 'Add applicant'}
          </button>
        </>
      }
    >
      <form id="add-applicant-form" onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
        <Field label="Name" required className="col-span-2">
          <input
            type="text"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            required
            placeholder="Candidate's full name"
            className="h-10 w-full rounded-[8px] border border-slate-200 bg-white px-3 text-[0.9rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:ring-2 focus:ring-[#2C5EF5]/20"
          />
        </Field>

        <Field label="Email">
          <input
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            placeholder="name@example.com"
            className="h-10 w-full rounded-[8px] border border-slate-200 bg-white px-3 text-[0.9rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:ring-2 focus:ring-[#2C5EF5]/20"
          />
        </Field>

        <Field label="Phone">
          <input
            type="text"
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            placeholder="Optional"
            className="h-10 w-full rounded-[8px] border border-slate-200 bg-white px-3 text-[0.9rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:ring-2 focus:ring-[#2C5EF5]/20"
          />
        </Field>

        <Field label="Applied for">
          <select
            value={form.job_posting_id}
            onChange={(e) => set('job_posting_id', e.target.value)}
            className="h-10 w-full rounded-[8px] border border-slate-200 bg-white px-3 text-[0.9rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:ring-2 focus:ring-[#2C5EF5]/20"
          >
            <option value="">— No posting —</option>
            {postings.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Resume URL">
          <input
            type="url"
            value={form.resume_url}
            onChange={(e) => set('resume_url', e.target.value)}
            placeholder="https://…"
            className="h-10 w-full rounded-[8px] border border-slate-200 bg-white px-3 text-[0.9rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:ring-2 focus:ring-[#2C5EF5]/20"
          />
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

function DeleteApplicantModal({ open, onClose, applicant, onConfirm }) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  async function handleConfirm() {
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm(applicant)
      onClose?.()
    } catch (err) {
      setError(err?.message ?? 'Could not delete this applicant.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onClose}
      size="sm"
      title="Delete applicant"
      description="This removes the candidate from the pipeline."
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
            disabled={submitting || !applicant}
            className="inline-flex h-9 items-center rounded-[8px] bg-red-600 px-3 text-[0.8rem] font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? <LoadingButtonLabel label="Deleting" /> : 'Delete applicant'}
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
          Delete <span className="font-semibold">{applicant?.name ?? 'this applicant'}</span> from
          the pipeline?
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

export default Applicants
