import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, FileText, Plus, Search, Trash2, X } from 'lucide-react'
import AdminLayout from '../../../layouts/AdminLayout.jsx'
import StatusBadge from '../../../components/common/StatusBadge.jsx'
import Modal from '../../../components/common/Modal/Modal.jsx'
import { LoadingButtonLabel, LoadingState } from '../../../components/common/LoadingBars.jsx'
import {
  DOC_TYPES,
  createDocument,
  deleteDocument,
  getAllDocuments,
} from '../../../services/document.service.js'
import { getEmployees } from '../../../services/employee.service.js'

/**
 * DocumentVault — org-wide browser for employee documents (HR Employee
 * Records panel). Backed by document.service / employee_documents.
 *
 * Mirrors the admin list pages: header + total count, a search/filter toolbar
 * with the request-token race guard, a table, and add/delete modals. Documents
 * are URL references (file_url), matching the app's link-not-upload pattern.
 *
 * If the 014 migration hasn't been run, the table is absent; we detect that
 * and show a hint instead of a broken page.
 */

// PostgREST surfaces a missing table as a schema-cache miss / undefined table.
function isMissingTableError(err) {
  const msg = (err?.message ?? '').toLowerCase()
  return (
    err?.code === '42P01' ||
    err?.code === 'PGRST205' ||
    (msg.includes('employee_documents') && msg.includes('does not exist')) ||
    msg.includes('could not find the table')
  )
}

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function DocumentVault() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [missing, setMissing] = useState(false)

  // Toolbar state
  const [query, setQuery] = useState('')
  const [docType, setDocType] = useState('')

  // Modal state
  const [addOpen, setAddOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const reqTokenRef = useRef(0)

  const load = useCallback(async () => {
    const token = ++reqTokenRef.current
    setLoading(true)
    setError(null)
    try {
      const { data } = await getAllDocuments({ docType: docType || undefined })
      if (token !== reqTokenRef.current) return
      let result = data ?? []
      // Free-text search → client-side over title + employee name.
      if (query.trim()) {
        const term = query.trim().toLowerCase()
        result = result.filter((r) => {
          const title = (r.title ?? '').toLowerCase()
          const name = (r.employee?.profile?.full_name ?? '').toLowerCase()
          return title.includes(term) || name.includes(term)
        })
      }
      setRows(result)
    } catch (err) {
      if (token !== reqTokenRef.current) return
      if (isMissingTableError(err)) {
        setMissing(true)
      } else {
        setError(err?.message ?? 'Failed to load documents.')
      }
      setRows([])
    } finally {
      if (token === reqTokenRef.current) setLoading(false)
    }
  }, [query, docType])

  // Debounce search keystrokes; type filter changes refetch immediately.
  useEffect(() => {
    const t = setTimeout(load, query.trim() ? 220 : 0)
    return () => clearTimeout(t)
  }, [load, query])

  async function handleCreate(payload) {
    await createDocument(payload)
    await load()
  }

  async function handleDelete(doc) {
    await deleteDocument(doc.id)
    setRows((prev) => prev.filter((r) => r.id !== doc.id))
  }

  const totalLabel = useMemo(() => {
    if (loading) {
      return <LoadingState label="Loading" barsClassName="h-3 w-5" />
    }
    return `${rows.length} ${rows.length === 1 ? 'document' : 'documents'}`
  }, [loading, rows.length])

  return (
    <AdminLayout>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="m-0 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
            Employee records
          </p>
          <h1 className="m-0 mt-2 text-[2rem] font-bold leading-[1.1] tracking-[-0.01em] text-[#0F1419] max-[600px]:text-[1.6rem]">
            Document vault
          </h1>
          <p className="mb-0 mt-2 text-[0.95rem] leading-snug text-[#4A5568]">
            Contracts, IDs, certifications, and reviews filed against employees.
          </p>
        </div>
        <span
          className="inline-flex items-center gap-2 rounded-[10px] bg-white px-3 py-2 text-[0.75rem] font-medium text-[#4A5568] shadow-[0_4px_12px_rgba(15,20,25,0.04)] [font-family:'Geist_Mono',monospace]"
          aria-label="Total documents"
        >
          <FileText size={12} strokeWidth={2.25} aria-hidden="true" />
          {totalLabel}
        </span>
      </header>

      {missing ? (
        <div className="rounded-[16px] border border-amber-200 bg-amber-50/60 p-5">
          <p className="m-0 text-[0.95rem] font-semibold text-[#0F1419]">Documents table not found.</p>
          <p className="m-0 mt-1 text-[0.85rem] text-[#4A5568]">
            Run{' '}
            <span className="[font-family:'Geist_Mono',monospace]">
              supabase/migrations/014_create_employee_documents.sql
            </span>{' '}
            in the Supabase SQL Editor, then reload this page.
          </p>
        </div>
      ) : (
        <>
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 rounded-[12px] border border-slate-200 bg-white p-2 shadow-[0_8px_24px_rgba(15,20,25,0.04)]">
            <div className="relative flex-1 min-w-[220px]">
              <Search
                size={14}
                strokeWidth={2}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by title or employee…"
                aria-label="Search documents"
                className="h-9 w-full rounded-[8px] border border-transparent bg-slate-50 pl-9 pr-9 text-[0.85rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:bg-white focus:ring-2 focus:ring-[#2C5EF5]/20"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded-[6px] text-[#94A3B8] transition-colors hover:bg-slate-100 hover:text-[#0F1419]"
                >
                  <X size={12} strokeWidth={2.25} />
                </button>
              ) : null}
            </div>

            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              aria-label="Filter by type"
              className="h-9 rounded-[8px] border border-slate-200 bg-white px-2 text-[0.85rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:ring-2 focus:ring-[#2C5EF5]/20"
            >
              <option value="">All types</option>
              {DOC_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-[#2C5EF5] px-3 text-[0.8rem] font-semibold text-white transition-colors hover:bg-[#1E47C9]"
            >
              <Plus size={14} strokeWidth={2.5} aria-hidden="true" />
              Add document
            </button>
          </div>

          {error ? (
            <p className="mt-4 rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-[0.85rem] text-red-700">
              {error}
            </p>
          ) : null}

          {/* Table */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="mt-4 overflow-hidden rounded-[16px] border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,20,25,0.04)]"
            aria-label="Documents"
          >
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-left">
                    {['Document', 'Type', 'Employee', 'Filed', ''].map((h, i) => (
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
                      <td colSpan={5} className="px-4 py-10 text-center text-[0.85rem] text-[#4A5568]">
                        <LoadingState label="Loading documents" />
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center">
                        <p className="m-0 text-[0.95rem] font-semibold text-[#0F1419]">
                          No documents match.
                        </p>
                        <p className="m-0 mt-1 text-[0.85rem] text-[#4A5568]">
                          Try clearing the search or filter, or add a document.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => (
                      <tr key={r.id} className="transition-colors hover:bg-slate-50/60">
                        <td className="px-4 py-3">
                          {r.file_url ? (
                            <a
                              href={r.file_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 text-[0.9rem] font-medium text-[#2C5EF5] hover:underline"
                            >
                              <FileText size={14} strokeWidth={2} aria-hidden="true" />
                              {r.title}
                            </a>
                          ) : (
                            <span className="inline-flex items-center gap-2 text-[0.9rem] font-medium text-[#0F1419]">
                              <FileText size={14} strokeWidth={2} className="text-[#94A3B8]" aria-hidden="true" />
                              {r.title}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge value={r.doc_type} />
                        </td>
                        <td className="px-4 py-3">
                          <p className="m-0 text-[0.85rem] text-[#0F1419]">
                            {r.employee?.profile?.full_name ?? 'Unknown'}
                          </p>
                          <p className="m-0 text-[0.75rem] text-[#94A3B8] [font-family:'Geist_Mono',monospace]">
                            {r.employee?.employee_number ?? '—'}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-[0.8rem] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
                          {formatDate(r.created_at)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(r)}
                            aria-label={`Delete ${r.title}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-[#4A5568] transition-colors hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 size={14} strokeWidth={2} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </motion.section>

          <AddDocumentModal
            open={addOpen}
            onClose={() => setAddOpen(false)}
            onSubmit={handleCreate}
          />
          <DeleteDocumentModal
            open={Boolean(deleteTarget)}
            onClose={() => setDeleteTarget(null)}
            document={deleteTarget}
            onConfirm={handleDelete}
          />
        </>
      )}
    </AdminLayout>
  )
}

// ── Add modal ─────────────────────────────────────────────────────────────
// Local to this page — single-use. Loads the employee list lazily on open.

const EMPTY = { employee_id: '', title: '', doc_type: 'other', file_url: '', notes: '' }

function AddDocumentModal({ open, onClose, onSubmit }) {
  const [form, setForm] = useState(EMPTY)
  const [employees, setEmployees] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  // Reset on open + lazily load the employee picker options.
  useEffect(() => {
    if (!open) return
    setForm(EMPTY)
    setError(null)
    let alive = true
    getEmployees({ limit: 500 })
      .then((res) => alive && setEmployees(res?.data ?? []))
      .catch(() => alive && setEmployees([]))
    return () => {
      alive = false
    }
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
        employee_id: form.employee_id || undefined,
        title: form.title.trim(),
        doc_type: form.doc_type,
        file_url: form.file_url.trim() || null,
        notes: form.notes.trim() || null,
      })
      onClose?.()
    } catch (err) {
      setError(err?.message ?? 'Could not save the document.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onClose}
      size="md"
      title="Add document"
      description="File a document against an employee. Paste a link to the file."
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
            form="add-document-form"
            disabled={submitting}
            className="inline-flex h-9 items-center rounded-[8px] bg-[#2C5EF5] px-3 text-[0.8rem] font-semibold text-white transition-colors hover:bg-[#1E47C9] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? <LoadingButtonLabel label="Saving" /> : 'Add document'}
          </button>
        </>
      }
    >
      <form id="add-document-form" onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
        <Field label="Employee" required className="col-span-2">
          <select
            value={form.employee_id}
            onChange={(e) => set('employee_id', e.target.value)}
            required
            className="h-10 w-full rounded-[8px] border border-slate-200 bg-white px-3 text-[0.9rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:ring-2 focus:ring-[#2C5EF5]/20"
          >
            <option value="">— Select employee —</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.profile?.full_name ?? 'Unnamed'} ({emp.employee_number})
              </option>
            ))}
          </select>
        </Field>

        <Field label="Title" required className="col-span-2">
          <input
            type="text"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            required
            placeholder="e.g. Employment contract 2026"
            className="h-10 w-full rounded-[8px] border border-slate-200 bg-white px-3 text-[0.9rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:ring-2 focus:ring-[#2C5EF5]/20"
          />
        </Field>

        <Field label="Type">
          <select
            value={form.doc_type}
            onChange={(e) => set('doc_type', e.target.value)}
            className="h-10 w-full rounded-[8px] border border-slate-200 bg-white px-3 text-[0.9rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:ring-2 focus:ring-[#2C5EF5]/20"
          >
            {DOC_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="File URL">
          <input
            type="url"
            value={form.file_url}
            onChange={(e) => set('file_url', e.target.value)}
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

function DeleteDocumentModal({ open, onClose, document, onConfirm }) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  async function handleConfirm() {
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm(document)
      onClose?.()
    } catch (err) {
      setError(err?.message ?? 'Could not delete this document.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onClose}
      size="sm"
      title="Delete document"
      description="This removes the record. The linked file itself is not touched."
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
            disabled={submitting || !document}
            className="inline-flex h-9 items-center rounded-[8px] bg-red-600 px-3 text-[0.8rem] font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? <LoadingButtonLabel label="Deleting" /> : 'Delete document'}
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
          Delete <span className="font-semibold">{document?.title ?? 'this document'}</span> from{' '}
          {document?.employee?.profile?.full_name ?? 'this employee'}’s record?
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

export default DocumentVault
