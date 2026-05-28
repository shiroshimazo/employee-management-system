import { useEffect, useState } from 'react'
import Modal from '../common/Modal/Modal.jsx'

/**
 * DepartmentFormModal — shared form for both "Add" and "Edit" flows.
 *
 * Mirrors EmployeeFormModal in shape and behavior so the two screens
 * feel like one product. The manager dropdown is populated from
 * department.service#getManagerCandidates() and passed in by the page.
 *
 * Props:
 *   open, onClose, mode, initialValue, managers, onSubmit
 *   - onSubmit(payload): caller does the actual create/update and
 *     surfaces errors. We pass a clean object back; the service strips
 *     unknown fields via its WRITABLE_COLUMNS allowlist.
 */

const STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
]

const EMPTY = {
  name: '',
  code: '',
  description: '',
  status: 'active',
  manager_id: '',
}

// Map a joined department row → flat form values. The page can hand us
// whatever shape the service returned and we'll cope.
function fromDepartment(row) {
  if (!row) return { ...EMPTY }
  return {
    name: row.name ?? '',
    code: row.code ?? '',
    description: row.description ?? '',
    status: row.status ?? 'active',
    // The joined `manager` object wins over the raw FK if both are present;
    // either way we end up with a UUID string the <select> can match.
    manager_id: row.manager?.id ?? row.manager_id ?? '',
  }
}

function DepartmentFormModal({
  open,
  onClose,
  mode = 'create',
  initialValue,
  managers = [],
  onSubmit,
}) {
  const [form, setForm] = useState(() => fromDepartment(initialValue))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  // Reset whenever the modal opens or the row being edited changes — without
  // this, the form would show the previous department's values.
  useEffect(() => {
    if (!open) return
    setForm(fromDepartment(initialValue))
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
      // The service's pickWritable() drops anything outside the allowlist,
      // and createDepartment / updateDepartment coerce empty strings to
      // null for nullable columns. We just need to trim user input.
      const payload = {
        name: form.name.trim(),
        code: form.code.trim(),
        description: form.description.trim(),
        status: form.status,
        manager_id: form.manager_id || '',
      }
      await onSubmit(payload)
      onClose?.()
    } catch (err) {
      setError(err?.message ?? 'Something went wrong saving the department.')
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
      title={isEdit ? 'Edit department' : 'Add department'}
      description={
        isEdit
          ? 'Update name, manager, status, or description.'
          : 'Create a new department and optionally assign its manager.'
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
            form="department-form"
            disabled={submitting}
            className="inline-flex h-9 items-center rounded-[8px] bg-[#2C5EF5] px-3 text-[0.8rem] font-semibold text-white transition-colors hover:bg-[#1E47C9] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create department'}
          </button>
        </>
      }
    >
      <form
        id="department-form"
        onSubmit={handleSubmit}
        className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1"
      >
        <Field
          label="Department name"
          required
          value={form.name}
          onChange={(v) => set('name', v)}
          className="col-span-2"
        />

        <Field
          label="Code"
          hint="Short identifier (e.g. ENG, HR)."
          value={form.code}
          onChange={(v) => set('code', v)}
        />

        <SelectField
          label="Status"
          value={form.status}
          onChange={(v) => set('status', v)}
          options={STATUSES}
        />

        <SelectField
          label="Manager"
          value={form.manager_id}
          onChange={(v) => set('manager_id', v)}
          options={[
            { value: '', label: '— Unassigned —' },
            ...managers.map((m) => ({
              value: m.id,
              label: m.full_name
                ? `${m.full_name}${m.role ? ` · ${m.role}` : ''}`
                : '(unnamed)',
            })),
          ]}
          className="col-span-2"
        />

        <TextareaField
          label="Description"
          value={form.description}
          onChange={(v) => set('description', v)}
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
// Local because they're shaped to this modal. If a third consumer shows up,
// promote to common/Form/*.

function Field({ label, hint, type = 'text', required, value, onChange, className = '' }) {
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
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-[8px] border border-slate-200 bg-white px-3 text-[0.9rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:ring-2 focus:ring-[#2C5EF5]/20"
      />
      {hint ? <span className="text-[0.7rem] text-[#94A3B8]">{hint}</span> : null}
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

function TextareaField({ label, value, onChange, className = '' }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-[0.7rem] font-medium uppercase tracking-[0.1em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
        {label}
      </span>
      <textarea
        rows={3}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-[0.9rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:ring-2 focus:ring-[#2C5EF5]/20"
      />
    </label>
  )
}

export default DepartmentFormModal
