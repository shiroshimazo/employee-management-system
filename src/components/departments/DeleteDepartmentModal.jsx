import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import Modal from '../common/Modal/Modal.jsx'
import { LoadingButtonLabel } from '../common/LoadingBars.jsx'

/**
 * DeleteDepartmentModal — destructive confirmation step.
 *
 * Surfaces the department name + employee count so the admin can sanity-check
 * the impact before the row is gone. The FK on employees.department_id is
 * `on delete set null`, which means deleting a department leaves its
 * employees in place with no department — we say so plainly here so the
 * admin isn't surprised after the fact.
 */
function DeleteDepartmentModal({ open, onClose, department, employeeCount = 0, onConfirm }) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const name = department?.name ?? '—'

  async function handleConfirm() {
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm(department)
      onClose?.()
    } catch (err) {
      setError(err?.message ?? 'Could not delete this department.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onClose}
      size="sm"
      title="Delete department"
      description="This permanently removes the department record."
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
            disabled={submitting || !department}
            className="inline-flex h-9 items-center rounded-[8px] bg-red-600 px-3 text-[0.8rem] font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? <LoadingButtonLabel label="Deleting" /> : 'Delete department'}
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
        <div className="min-w-0">
          <p className="m-0 text-[0.9rem] text-[#0F1419]">
            You're about to delete{' '}
            <span className="font-semibold">{name}</span>.
          </p>
          <p className="m-0 mt-1 text-[0.8rem] text-[#4A5568]">
            {employeeCount > 0 ? (
              <>
                {employeeCount} {employeeCount === 1 ? 'employee is' : 'employees are'} currently
                assigned. They'll stay in place but lose their department —
                you can reassign them afterward, or set status to{' '}
                <span className="font-semibold">Archived</span> instead to keep history.
              </>
            ) : (
              <>
                No employees are assigned. For a non-destructive disable, set status
                to <span className="font-semibold">Archived</span>.
              </>
            )}
          </p>
        </div>
      </div>

      {error ? (
        <p className="m-0 mt-3 rounded-[8px] bg-red-50 px-3 py-2 text-[0.8rem] text-red-700">
          {error}
        </p>
      ) : null}
    </Modal>
  )
}

export default DeleteDepartmentModal
