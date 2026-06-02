import { useEffect, useState } from 'react'
import Modal from '../common/Modal/Modal.jsx'
import { LoadingButtonLabel } from '../common/LoadingBars.jsx'

/**
 * EmployeeFormModal — shared form for both "Add" and "Edit" flows.
 *
 * One form, two intents:
 *   - mode='create': asks for profile_id + employee_number (the FK + the
 *     human-readable id). The auth user must already exist; this modal
 *     does not provision one.
 *   - mode='edit':   profile_id is locked, employee_number is editable
 *     but kept on the form so admins can correct typos.
 *
 * Props:
 *   open, onClose, mode, initialValue, departments, onSubmit
 *   - onSubmit(payload): caller does the actual create/update and surfaces
 *     errors. We pass a clean object back; the service strips unknowns.
 */

const EMPLOYMENT_TYPES = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'intern', label: 'Intern' },
]

const STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'on_leave', label: 'On Leave' },
  { value: 'probation', label: 'Probation' },
  { value: 'terminated', label: 'Terminated' },
  { value: 'inactive', label: 'Inactive' },
]

const EMPTY = {
  profile_id: '',
  employee_number: '',
  position: '',
  department_id: '',
  employment_type: 'full_time',
  status: 'active',
  hire_date: '',
  salary: '',
}

// Map a joined "rich" employee row → flat form values. Keeps the page free
// of mapping logic; whatever shape the service returns can land in initialValue.
function fromEmployee(row) {
  if (!row) return { ...EMPTY }
  return {
    profile_id: row.profile?.id ?? '',
    employee_number: row.employee_number ?? '',
    position: row.position ?? '',
    department_id: row.department?.id ?? '',
    employment_type: row.employment_type ?? 'full_time',
    status: row.status ?? 'active',
    hire_date: row.hire_date ?? '',
    salary: row.salary != null ? String(row.salary) : '',
  }
}

function EmployeeFormModal({
  open,
  onClose,
  mode = 'create',
  initialValue,
  departments = [],
  onSubmit,
}) {
  const [form, setForm] = useState(() => fromEmployee(initialValue))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  // Reset the form whenever the modal opens or the row being edited
  // changes — otherwise the modal would show stale fields.
  useEffect(() => {
    if (!open) return
    setForm(fromEmployee(initialValue))
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
      // Coerce + drop empty optional fields so we don't send '' to columns
      // typed as date/numeric — Postgres rejects that.
      const payload = {
        profile_id: form.profile_id || undefined,
        employee_number: form.employee_number.trim(),
        position: form.position.trim() || null,
        department_id: form.department_id || null,
        employment_type: form.employment_type,
        status: form.status,
        hire_date: form.hire_date || null,
        salary: form.salary === '' ? null : Number(form.salary),
      }
      if (mode === 'edit') delete payload.profile_id
      await onSubmit(payload)
      onClose?.()
    } catch (err) {
      setError(err?.message ?? 'Something went wrong saving the employee.')
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
      title={isEdit ? 'Edit employee' : 'Add employee'}
      description={
        isEdit
          ? 'Update employment details and status.'
          : 'Provision an auth user first, then attach their HR record here.'
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
            form="employee-form"
            disabled={submitting}
            className="inline-flex h-9 items-center rounded-[8px] bg-[#2C5EF5] px-3 text-[0.8rem] font-semibold text-white transition-colors hover:bg-[#1E47C9] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <LoadingButtonLabel label="Saving" />
            ) : isEdit ? (
              'Save changes'
            ) : (
              'Create employee'
            )}
          </button>
        </>
      }
    >
      <form id="employee-form" onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
        {!isEdit ? (
          <Field
            label="Profile ID"
            hint="UUID of the auth user (provision via Supabase first)."
            required
            value={form.profile_id}
            onChange={(v) => set('profile_id', v)}
          />
        ) : null}

        <Field
          label="Employee number"
          required
          value={form.employee_number}
          onChange={(v) => set('employee_number', v)}
        />

        <Field
          label="Position"
          value={form.position}
          onChange={(v) => set('position', v)}
        />

        <SelectField
          label="Department"
          value={form.department_id}
          onChange={(v) => set('department_id', v)}
          options={[
            { value: '', label: '— Unassigned —' },
            ...departments.map((d) => ({ value: d.id, label: d.name })),
          ]}
        />

        <SelectField
          label="Employment type"
          value={form.employment_type}
          onChange={(v) => set('employment_type', v)}
          options={EMPLOYMENT_TYPES}
        />

        <SelectField
          label="Status"
          value={form.status}
          onChange={(v) => set('status', v)}
          options={STATUSES}
        />

        <Field
          label="Hire date"
          type="date"
          value={form.hire_date}
          onChange={(v) => set('hire_date', v)}
        />

        <Field
          label="Salary"
          type="number"
          step="0.01"
          value={form.salary}
          onChange={(v) => set('salary', v)}
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

// ── Tiny field primitives — local because they're shaped to this form's
// look. Promote to common/Form/* if a second consumer appears.

function Field({ label, hint, type = 'text', step, required, value, onChange }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[0.7rem] font-medium uppercase tracking-[0.1em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
        {label}
        {required ? <span className="ml-1 text-red-500">*</span> : null}
      </span>
      <input
        type={type}
        step={step}
        required={required}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-[8px] border border-slate-200 bg-white px-3 text-[0.9rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:ring-2 focus:ring-[#2C5EF5]/20"
      />
      {hint ? <span className="text-[0.7rem] text-[#94A3B8]">{hint}</span> : null}
    </label>
  )
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label className="flex flex-col gap-1.5">
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

export default EmployeeFormModal
