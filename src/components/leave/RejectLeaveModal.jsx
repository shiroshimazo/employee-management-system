import { useEffect, useState } from 'react'
import { XCircle } from 'lucide-react'
import Modal from '../common/Modal/Modal.jsx'

/**
 * RejectLeaveModal — captures the rejection reason before sending it to
 * leave.service#rejectLeaveRequest, which requires a non-empty reason.
 *
 * Surfacing the requester's name + dates in the body so the approver
 * sees what they're rejecting at a glance — easy to mis-click in a
 * long pending queue otherwise.
 */
function RejectLeaveModal({ open, onClose, request, onConfirm }) {
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open) return
    setReason('')
    setError(null)
  }, [open])

  const name = request?.employee?.profile?.full_name ?? 'this employee'
  const dates =
    request?.start_date && request?.end_date
      ? `${request.start_date} → ${request.end_date}`
      : '—'

  async function handleConfirm() {
    if (!reason.trim()) {
      setError('A rejection reason is required.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm(reason.trim())
      onClose?.()
    } catch (err) {
      setError(err?.message ?? 'Could not reject the request.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onClose}
      size="sm"
      title="Reject leave request"
      description="Tell the requester why so they can plan around it."
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
            disabled={submitting}
            className="inline-flex h-9 items-center rounded-[8px] bg-red-600 px-3 text-[0.8rem] font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Rejecting…' : 'Reject request'}
          </button>
        </>
      }
    >
      <div className="flex items-start gap-3 rounded-[10px] border border-red-100 bg-red-50/60 p-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700"
          aria-hidden="true"
        >
          <XCircle size={16} strokeWidth={2.25} />
        </span>
        <div className="min-w-0">
          <p className="m-0 text-[0.9rem] text-[#0F1419]">
            Rejecting <span className="font-semibold">{name}</span>'s request.
          </p>
          <p className="m-0 mt-0.5 text-[0.78rem] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
            {dates}
          </p>
        </div>
      </div>

      <label className="mt-4 flex flex-col gap-1.5">
        <span className="text-[0.7rem] font-medium uppercase tracking-[0.1em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
          Reason <span className="text-red-500">*</span>
        </span>
        <textarea
          rows={3}
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Conflicts with end-of-quarter close — please rebook for the following week."
          className="rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-[0.9rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:ring-2 focus:ring-[#2C5EF5]/20"
        />
      </label>

      {error ? (
        <p className="m-0 mt-3 rounded-[8px] bg-red-50 px-3 py-2 text-[0.8rem] text-red-700">
          {error}
        </p>
      ) : null}
    </Modal>
  )
}

export default RejectLeaveModal
