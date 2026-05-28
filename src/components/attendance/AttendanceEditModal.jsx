import { useEffect, useState } from 'react'
import Modal from '../common/Modal/Modal.jsx'

/**
 * AttendanceEditModal — admin/HR manual edit of a single attendance row.
 *
 * RLS gates the actual write (`attendance_update_admin_hr`); this modal just
 * collects the patch. The service re-validates on submit, so users see the
 * same error message regardless of which path triggered it.
 *
 * Fields:
 *   - employee + date are read-only (changing them turns this into a move,
 *     which is the wrong operation — make a new row instead)
 *   - clock_in / clock_out use <input type="datetime-local">, which works
 *     on the user's local clock; we convert to/from ISO at the boundary
 *   - status is a dropdown of the DB enum
 *   - notes is a free-text remarks field (DB column: `notes`)
 */

const STATUSES = [
  { value: 'present', label: 'Present' },
  { value: 'late', label: 'Late' },
  { value: 'absent', label: 'Absent' },
  { value: 'half_day', label: 'Half day' },
  { value: 'leave', label: 'On leave' },
  { value: 'remote', label: 'Remote' },
]

// `datetime-local` inputs want `YYYY-MM-DDTHH:mm`. Browsers can't read an
// ISO string with a Z suffix back into the input — they expect local-naive
// text. We bridge both directions here.
function isoToLocalInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function localInputToISO(value) {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

function fromRow(row) {
  return {
    check_in: isoToLocalInput(row?.check_in),
    check_out: isoToLocalInput(row?.check_out),
    status: row?.status ?? 'present',
    notes: row?.notes ?? '',
  }
}

function AttendanceEditModal({ open, onClose, record, onSubmit }) {
  const [form, setForm] = useState(() => fromRow(record))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open) return
    setForm(fromRow(record))
    setError(null)
  }, [open, record])

  const empName = record?.employee?.profile?.full_name ?? '—'
  const empNumber = record?.employee?.employee_number ?? '—'
  const date = record?.date ?? '—'

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const patch = {
        check_in: localInputToISO(form.check_in),
        check_out: localInputToISO(form.check_out),
        status: form.status,
        notes: form.notes.trim() || null,
      }
      await onSubmit(patch)
      onClose?.()
    } catch (err) {
      setError(err?.message ?? 'Could not save the attendance record.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onClose}
      size="md"
      title="Edit attendance"
      description={`${empName} · ${empNumber} · ${date}`}
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
            form="attendance-edit-form"
            disabled={submitting || !record}
            className="inline-flex h-9 items-center rounded-[8px] bg-[#2C5EF5] px-3 text-[0.8rem] font-semibold text-white transition-colors hover:bg-[#1E47C9] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Saving…' : 'Save changes'}
          </button>
        </>
      }
    >
      <form
        id="attendance-edit-form"
        onSubmit={handleSubmit}
        className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1"
      >
        <Field
          label="Clock in"
          type="datetime-local"
          value={form.check_in}
          onChange={(v) => set('check_in', v)}
        />
        <Field
          label="Clock out"
          type="datetime-local"
          // datetime-local's `min` matches the value format, so this caps
          // the picker to dates after the chosen clock-in.
          min={form.check_in || undefined}
          value={form.check_out}
          onChange={(v) => set('check_out', v)}
        />

        <SelectField
          label="Status"
          value={form.status}
          onChange={(v) => set('status', v)}
          options={STATUSES}
          className="col-span-2"
        />

        <TextareaField
          label="Remarks"
          value={form.notes}
          onChange={(v) => set('notes', v)}
          placeholder="Optional context — late traffic, client meeting offsite, etc."
          className="col-span-2"
        />

        {error ? (
          <p className="col-span-2 m-0 rounded-[8px] bg-red-50 px-3 py-2 text-[0.8rem] text-red-700">
            {error}
          </p>
        ) : null}
      </form>
    </Modal>
  )
}

// ── Local field primitives ─────────────────────────────────────────────────

function Field({ label, type = 'text', value, onChange, min, className = '' }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-[0.7rem] font-medium uppercase tracking-[0.1em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
        {label}
      </span>
      <input
        type={type}
        value={value ?? ''}
        min={min}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-[8px] border border-slate-200 bg-white px-3 text-[0.9rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:ring-2 focus:ring-[#2C5EF5]/20"
      />
    </label>
  )
}

function SelectField({ label, value, onChange, options, className = '' }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-[0.7rem] font-medium uppercase tracking-[0.1em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
        {label}
      </span>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-[8px] border border-slate-200 bg-white px-3 text-[0.9rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:ring-2 focus:ring-[#2C5EF5]/20"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function TextareaField({ label, value, onChange, placeholder, className = '' }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-[0.7rem] font-medium uppercase tracking-[0.1em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
        {label}
      </span>
      <textarea
        rows={3}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-[0.9rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:ring-2 focus:ring-[#2C5EF5]/20"
      />
    </label>
  )
}

export default AttendanceEditModal
