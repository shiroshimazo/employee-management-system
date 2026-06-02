import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, CalendarDays, Plus, Trash2 } from 'lucide-react'
import AdminLayout from '../../../layouts/AdminLayout.jsx'
import Modal from '../../../components/common/Modal/Modal.jsx'
import { LoadingButtonLabel, LoadingState } from '../../../components/common/LoadingBars.jsx'
import { createHoliday, deleteHoliday, getHolidays } from '../../../services/holiday.service.js'

/**
 * HolidayCalendar — company-observed holidays (HR Leave Management panel).
 *
 * Backed by holiday.service / the holidays table. Admin/HR add and remove;
 * everyone can read. If the 015 migration hasn't been run, the table is
 * absent — we detect that and show a hint instead of a broken page.
 */

// PostgREST surfaces a missing table as a schema-cache miss / undefined table.
function isMissingTableError(err) {
  const msg = (err?.message ?? '').toLowerCase()
  return (
    err?.code === '42P01' ||
    err?.code === 'PGRST205' ||
    (msg.includes('holidays') && msg.includes('does not exist')) ||
    msg.includes('could not find the table')
  )
}

// Holidays are stored as plain 'YYYY-MM-DD'. Format at local midnight so the
// displayed day matches what was entered (not shifted by UTC parsing).
function formatHolidayDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '')
  if (!m) return '—'
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function todayISO() {
  const d = new Date()
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${day}`
}

function HolidayCalendar() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [missing, setMissing] = useState(false)

  const [addOpen, setAddOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getHolidays()
      setRows(data ?? [])
    } catch (err) {
      if (isMissingTableError(err)) {
        setMissing(true)
      } else {
        setError(err?.message ?? 'Failed to load holidays.')
      }
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Defer the load out of the synchronous effect body — same pattern the
  // other admin pages use to keep setState off the render path.
  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  async function handleCreate(payload) {
    await createHoliday(payload)
    await load()
  }

  async function handleDelete(holiday) {
    await deleteHoliday(holiday.id)
    setRows((prev) => prev.filter((r) => r.id !== holiday.id))
  }

  const today = todayISO()
  const totalLabel = useMemo(() => {
    if (loading) {
      return <LoadingState label="Loading" barsClassName="h-3 w-5" />
    }
    return `${rows.length} ${rows.length === 1 ? 'holiday' : 'holidays'}`
  }, [loading, rows.length])

  return (
    <AdminLayout>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="m-0 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
            Leave management
          </p>
          <h1 className="m-0 mt-2 text-[2rem] font-bold leading-[1.1] tracking-[-0.01em] text-[#0F1419] max-[600px]:text-[1.6rem]">
            Holiday calendar
          </h1>
          <p className="mb-0 mt-2 text-[0.95rem] leading-snug text-[#4A5568]">
            Company-observed holidays. Everyone can see these; HR maintains them.
          </p>
        </div>
        <span
          className="inline-flex items-center gap-2 rounded-[10px] bg-white px-3 py-2 text-[0.75rem] font-medium text-[#4A5568] shadow-[0_4px_12px_rgba(15,20,25,0.04)] [font-family:'Geist_Mono',monospace]"
          aria-label="Total holidays"
        >
          <CalendarDays size={12} strokeWidth={2.25} aria-hidden="true" />
          {totalLabel}
        </span>
      </header>

      {missing ? (
        <div className="rounded-[16px] border border-amber-200 bg-amber-50/60 p-5">
          <p className="m-0 text-[0.95rem] font-semibold text-[#0F1419]">Holidays table not found.</p>
          <p className="m-0 mt-1 text-[0.85rem] text-[#4A5568]">
            Run{' '}
            <span className="[font-family:'Geist_Mono',monospace]">
              supabase/migrations/015_create_holidays.sql
            </span>{' '}
            in the Supabase SQL Editor, then reload this page.
          </p>
        </div>
      ) : (
        <>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-[#2C5EF5] px-3 text-[0.8rem] font-semibold text-white transition-colors hover:bg-[#1E47C9]"
            >
              <Plus size={14} strokeWidth={2.5} aria-hidden="true" />
              Add holiday
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
            aria-label="Holidays"
          >
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-left">
                    {['Holiday', 'Date', 'Notes', ''].map((h, i) => (
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
                      <td colSpan={4} className="px-4 py-10 text-center text-[0.85rem] text-[#4A5568]">
                        <LoadingState label="Loading holidays" />
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center">
                        <p className="m-0 text-[0.95rem] font-semibold text-[#0F1419]">
                          No holidays yet.
                        </p>
                        <p className="m-0 mt-1 text-[0.85rem] text-[#4A5568]">
                          Add the company's observed holidays to get started.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => {
                      const past = r.holiday_date < today
                      return (
                        <tr
                          key={r.id}
                          className={`transition-colors hover:bg-slate-50/60 ${past ? 'opacity-60' : ''}`}
                        >
                          <td className="px-4 py-3 text-[0.9rem] font-medium text-[#0F1419]">
                            {r.name}
                          </td>
                          <td className="px-4 py-3 text-[0.8rem] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
                            {formatHolidayDate(r.holiday_date)}
                          </td>
                          <td className="max-w-[320px] px-4 py-3 text-[0.85rem] text-[#4A5568]">
                            <span className="line-clamp-2">{r.notes ?? '—'}</span>
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

          <AddHolidayModal
            open={addOpen}
            onClose={() => setAddOpen(false)}
            onSubmit={handleCreate}
          />
          <DeleteHolidayModal
            open={Boolean(deleteTarget)}
            onClose={() => setDeleteTarget(null)}
            holiday={deleteTarget}
            onConfirm={handleDelete}
          />
        </>
      )}
    </AdminLayout>
  )
}

const EMPTY = { name: '', holiday_date: '', notes: '' }

function AddHolidayModal({ open, onClose, onSubmit }) {
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
        holiday_date: form.holiday_date,
        notes: form.notes.trim() || null,
      })
      onClose?.()
    } catch (err) {
      setError(err?.message ?? 'Could not save the holiday.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onClose}
      size="sm"
      title="Add holiday"
      description="Add a company-observed holiday."
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
            form="add-holiday-form"
            disabled={submitting}
            className="inline-flex h-9 items-center rounded-[8px] bg-[#2C5EF5] px-3 text-[0.8rem] font-semibold text-white transition-colors hover:bg-[#1E47C9] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? <LoadingButtonLabel label="Saving" /> : 'Add holiday'}
          </button>
        </>
      }
    >
      <form id="add-holiday-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-[0.7rem] font-medium uppercase tracking-[0.1em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
            Name <span className="text-red-500">*</span>
          </span>
          <input
            type="text"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            required
            placeholder="e.g. New Year's Day"
            className="h-10 rounded-[8px] border border-slate-200 bg-white px-3 text-[0.9rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:ring-2 focus:ring-[#2C5EF5]/20"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[0.7rem] font-medium uppercase tracking-[0.1em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
            Date <span className="text-red-500">*</span>
          </span>
          <input
            type="date"
            value={form.holiday_date}
            onChange={(e) => set('holiday_date', e.target.value)}
            required
            className="h-10 rounded-[8px] border border-slate-200 bg-white px-3 text-[0.9rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:ring-2 focus:ring-[#2C5EF5]/20"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[0.7rem] font-medium uppercase tracking-[0.1em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
            Notes
          </span>
          <textarea
            rows={2}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Optional context…"
            className="rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-[0.9rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:ring-2 focus:ring-[#2C5EF5]/20"
          />
        </label>

        {error ? (
          <p className="m-0 rounded-[8px] bg-red-50 px-3 py-2 text-[0.8rem] text-red-700">
            {error}
          </p>
        ) : null}
      </form>
    </Modal>
  )
}

function DeleteHolidayModal({ open, onClose, holiday, onConfirm }) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  async function handleConfirm() {
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm(holiday)
      onClose?.()
    } catch (err) {
      setError(err?.message ?? 'Could not delete this holiday.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onClose}
      size="sm"
      title="Delete holiday"
      description="This removes it from the calendar."
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
            disabled={submitting || !holiday}
            className="inline-flex h-9 items-center rounded-[8px] bg-red-600 px-3 text-[0.8rem] font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? <LoadingButtonLabel label="Deleting" /> : 'Delete holiday'}
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
          Delete <span className="font-semibold">{holiday?.name ?? 'this holiday'}</span> from the
          calendar?
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

export default HolidayCalendar
