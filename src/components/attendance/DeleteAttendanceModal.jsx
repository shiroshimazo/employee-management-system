import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import Modal from '../common/Modal/Modal.jsx'

/**
 * DeleteAttendanceModal — destructive confirmation step for admin/HR.
 *
 * Surfaces the row's identity (employee + date + status) so a busy admin
 * doesn't accidentally remove the wrong day. RLS gates the actual delete
 * (`attendance_delete_admin_hr`); we surface its error verbatim if it
 * fires.
 */
function DeleteAttendanceModal({ open, onClose, record, onConfirm }) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const name = record?.employee?.profile?.full_name ?? '—'
  const date = record?.date ?? '—'

  async function handleConfirm() {
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm(record)
      onClose?.()
    } catch (err) {
      setError(err?.message ?? 'Could not delete this record.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onClose}
      size="sm"
      title="Delete attendance record"
      description="This permanently removes the day's punch."
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
            disabled={submitting || !record}
            className="inline-flex h-9 items-center rounded-[8px] bg-red-600 px-3 text-[0.8rem] font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Deleting…' : 'Delete record'}
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
            Removing <span className="font-semibold">{name}</span>'s record for{' '}
            <span className="font-semibold">{date}</span>.
          </p>
          <p className="m-0 mt-1 text-[0.8rem] text-[#4A5568]">
            This cannot be undone. To correct a mistake instead, use{' '}
            <span className="font-semibold">Edit attendance</span> and adjust the values.
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

export default DeleteAttendanceModal
