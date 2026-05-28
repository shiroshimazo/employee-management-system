import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import Modal from '../common/Modal/Modal.jsx'

/**
 * DeleteEmployeeModal — destructive confirmation step.
 *
 * Surfacing the employee name + employee_number in the body so the admin
 * can sanity-check they're about to remove the right person before the
 * row is gone. Deletion is irreversible; the comment in employee.service
 * recommends `status: 'terminated'` for soft-delete needs.
 */
function DeleteEmployeeModal({ open, onClose, employee, onConfirm }) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const name = employee?.profile?.full_name ?? '—'
  const number = employee?.employee_number ?? '—'

  async function handleConfirm() {
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm(employee)
      onClose?.()
    } catch (err) {
      setError(err?.message ?? 'Could not delete this employee.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onClose}
      size="sm"
      title="Delete employee"
      description="This permanently removes their HR record."
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
            disabled={submitting || !employee}
            className="inline-flex h-9 items-center rounded-[8px] bg-red-600 px-3 text-[0.8rem] font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Deleting…' : 'Delete employee'}
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
            <span className="font-semibold">{name}</span>{' '}
            <span className="text-[#4A5568]">({number})</span>.
          </p>
          <p className="m-0 mt-1 text-[0.8rem] text-[#4A5568]">
            Their auth account and profile remain. This cannot be undone — for a
            soft-disable, set status to "Terminated" instead.
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

export default DeleteEmployeeModal
