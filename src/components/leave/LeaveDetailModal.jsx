import { ExternalLink } from 'lucide-react'
import Modal from '../common/Modal/Modal.jsx'
import StatusBadge from '../common/StatusBadge.jsx'

/**
 * LeaveDetailModal — read-only view of a leave request.
 *
 * Surfacing every relevant field in one place so the approver / requester
 * doesn't need to hunt around. The decision footer (note + decided_at +
 * approver name) only renders for non-pending rows so pending requests
 * don't show empty cells.
 */

function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function fmtDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function LeaveDetailModal({ open, onClose, request }) {
  if (!request) {
    return <Modal open={open} onClose={onClose} size="md" />
  }

  const empName = request.employee?.profile?.full_name ?? 'Unnamed'
  const empNumber = request.employee?.employee_number ?? '—'
  const dept = request.employee?.department?.name ?? '—'
  const decided = request.status !== 'pending'

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="Leave request"
      description={`${empName} · ${empNumber}`}
      footer={
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-9 items-center rounded-[8px] border border-slate-200 bg-white px-3 text-[0.8rem] font-medium text-[#4A5568] transition-colors hover:bg-slate-50"
        >
          Close
        </button>
      }
    >
      <dl className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
        <Detail label="Type">
          <StatusBadge value={request.leave_type} />
        </Detail>
        <Detail label="Status">
          <StatusBadge value={request.status} />
        </Detail>

        <Detail label="Start date">{fmtDate(request.start_date)}</Detail>
        <Detail label="End date">{fmtDate(request.end_date)}</Detail>

        <Detail label="Days">
          <span className="[font-family:'Geist_Mono',monospace]">
            {request.days ?? '—'}
          </span>
        </Detail>
        <Detail label="Department">{dept}</Detail>

        <Detail label="Reason" full>
          <p className="m-0 whitespace-pre-wrap text-[0.9rem] text-[#0F1419]">
            {request.reason ?? '—'}
          </p>
        </Detail>

        {request.attachment_url ? (
          <Detail label="Attachment" full>
            <a
              href={request.attachment_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[0.85rem] font-medium text-[#2C5EF5] hover:text-[#1E47C9]"
            >
              View attachment
              <ExternalLink size={12} strokeWidth={2.25} aria-hidden="true" />
            </a>
          </Detail>
        ) : null}

        {decided ? (
          <>
            <Detail label="Decided at">{fmtDateTime(request.decided_at)}</Detail>
            <Detail label="Decided by">
              {request.approver?.full_name ?? '—'}
            </Detail>
            {request.decision_note ? (
              <Detail label="Note" full>
                <p className="m-0 whitespace-pre-wrap text-[0.9rem] text-[#0F1419]">
                  {request.decision_note}
                </p>
              </Detail>
            ) : null}
          </>
        ) : null}

        <Detail label="Submitted">{fmtDateTime(request.created_at)}</Detail>
      </dl>
    </Modal>
  )
}

function Detail({ label, children, full = false }) {
  return (
    <div className={full ? 'col-span-2 max-[640px]:col-span-1' : ''}>
      <dt className="m-0 text-[0.65rem] font-medium uppercase tracking-[0.1em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
        {label}
      </dt>
      <dd className="m-0 mt-1 text-[0.9rem] text-[#0F1419]">{children}</dd>
    </div>
  )
}

export default LeaveDetailModal
