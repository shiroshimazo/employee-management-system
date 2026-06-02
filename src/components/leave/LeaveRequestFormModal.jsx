import { useEffect, useMemo, useState } from 'react'
import Modal from '../common/Modal/Modal.jsx'
import { LoadingButtonLabel } from '../common/LoadingBars.jsx'

/**
 * LeaveRequestFormModal — submit a new leave request, or edit a pending one.
 *
 * The form mirrors the validation in leave.service#validateLeaveInput so
 * users see errors before we hit Postgres:
 *   - leave_type required
 *   - reason required
 *   - end_date >= start_date
 *
 * `days` is computed live from the date range so the user can see what
 * they're requesting; the service recomputes on submit so the value can't
 * drift if someone tweaks dates in flight.
 *
 * Props:
 *   open, onClose, mode, initialValue, employeeId, onSubmit
 *   - employeeId: the employees.id row for the requester (the page knows
 *     this; the modal just plumbs it through to the payload).
 */

const LEAVE_TYPES = [
  { value: 'vacation', label: 'Vacation' },
  { value: 'sick', label: 'Sick' },
  { value: 'personal', label: 'Personal' },
  { value: 'bereavement', label: 'Bereavement' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'maternity', label: 'Maternity' },
  { value: 'paternity', label: 'Paternity' },
]

const EMPTY = {
  leave_type: 'vacation',
  start_date: '',
  end_date: '',
  reason: '',
  attachment_url: '',
}

function fromRow(row) {
  if (!row) return { ...EMPTY }
  return {
    leave_type: row.leave_type ?? 'vacation',
    start_date: row.start_date ?? '',
    end_date: row.end_date ?? '',
    reason: row.reason ?? '',
    attachment_url: row.attachment_url ?? '',
  }
}

// Inclusive day count between two ISO dates. Matches the service helper so
// the previewed value matches what the DB will store.
function inclusiveDays(startISO, endISO) {
  if (!startISO || !endISO) return 0
  const ms = 1000 * 60 * 60 * 24
  const a = new Date(startISO).getTime()
  const b = new Date(endISO).getTime()
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0
  return Math.round((b - a) / ms) + 1
}

function LeaveRequestFormModal({
  open,
  onClose,
  mode = 'create',
  initialValue,
  employeeId,
  onSubmit,
}) {
  const [form, setForm] = useState(() => fromRow(initialValue))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open) return
    setForm(fromRow(initialValue))
    setError(null)
  }, [open, initialValue])

  const days = useMemo(
    () => inclusiveDays(form.start_date, form.end_date),
    [form.start_date, form.end_date],
  )

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const payload = {
        employee_id: employeeId,
        leave_type: form.leave_type,
        start_date: form.start_date,
        end_date: form.end_date,
        reason: form.reason,
        attachment_url: form.attachment_url.trim() || null,
      }
      await onSubmit(payload)
      onClose?.()
    } catch (err) {
      setError(err?.message ?? 'Could not save the leave request.')
    } finally {
      setSubmitting(false)
    }
  }

  const isEdit = mode === 'edit'

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onClose}
      size="md"
      title={isEdit ? 'Edit leave request' : 'Submit leave request'}
      description={
        isEdit
          ? 'Update your pending request.'
          : 'Tell us when you need off and why.'
      }
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
            form="leave-form"
            disabled={submitting}
            className="inline-flex h-9 items-center rounded-[8px] bg-[#2C5EF5] px-3 text-[0.8rem] font-semibold text-white transition-colors hover:bg-[#1E47C9] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <LoadingButtonLabel label="Saving" />
            ) : isEdit ? (
              'Save changes'
            ) : (
              'Submit request'
            )}
          </button>
        </>
      }
    >
      <form
        id="leave-form"
        onSubmit={handleSubmit}
        className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1"
      >
        <SelectField
          label="Leave type"
          required
          value={form.leave_type}
          onChange={(v) => set('leave_type', v)}
          options={LEAVE_TYPES}
          className="col-span-2"
        />

        <Field
          label="Start date"
          type="date"
          required
          value={form.start_date}
          onChange={(v) => set('start_date', v)}
        />
        <Field
          label="End date"
          type="date"
          required
          // Inputs with min=startDate prevent picking earlier; we still
          // re-validate in the service in case it's bypassed.
          min={form.start_date || undefined}
          value={form.end_date}
          onChange={(v) => set('end_date', v)}
        />

        <div className="col-span-2 -mt-1 flex items-center gap-2 text-[0.78rem] text-[#4A5568]">
          <span className="rounded-[6px] bg-slate-100 px-2 py-0.5 [font-family:'Geist_Mono',monospace]">
            {days || 0} {days === 1 ? 'day' : 'days'}
          </span>
          <span className="text-[#94A3B8]">
            inclusive of both start and end dates
          </span>
        </div>

        <TextareaField
          label="Reason"
          required
          value={form.reason}
          onChange={(v) => set('reason', v)}
          className="col-span-2"
          placeholder="Briefly describe the purpose of this leave."
        />

        <Field
          label="Attachment URL"
          hint="Optional — link to supporting documentation (Supabase Storage URL, etc.)."
          value={form.attachment_url}
          onChange={(v) => set('attachment_url', v)}
          placeholder="https://…"
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

function Field({ label, hint, type = 'text', required, value, onChange, placeholder, min, className = '' }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-[0.7rem] font-medium uppercase tracking-[0.1em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
        {label}
        {required ? <span className="ml-1 text-red-500">*</span> : null}
      </span>
      <input
        type={type}
        required={required}
        value={value ?? ''}
        min={min}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-[8px] border border-slate-200 bg-white px-3 text-[0.9rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:ring-2 focus:ring-[#2C5EF5]/20"
      />
      {hint ? <span className="text-[0.7rem] text-[#94A3B8]">{hint}</span> : null}
    </label>
  )
}

function SelectField({ label, value, onChange, options, required, className = '' }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-[0.7rem] font-medium uppercase tracking-[0.1em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
        {label}
        {required ? <span className="ml-1 text-red-500">*</span> : null}
      </span>
      <select
        required={required}
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

function TextareaField({ label, value, onChange, placeholder, required, className = '' }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-[0.7rem] font-medium uppercase tracking-[0.1em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
        {label}
        {required ? <span className="ml-1 text-red-500">*</span> : null}
      </span>
      <textarea
        rows={3}
        required={required}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-[0.9rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:ring-2 focus:ring-[#2C5EF5]/20"
      />
    </label>
  )
}

export default LeaveRequestFormModal
