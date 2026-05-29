import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, X } from 'lucide-react'
import {
  approveLeaveRequest,
  getPendingLeaveRequests,
  rejectLeaveRequest,
} from '../../services/leave.service.js'
import StatusBadge from '../common/StatusBadge.jsx'
import RejectLeaveModal from '../leave/RejectLeaveModal.jsx'

function initials(name) {
  if (!name) return '–'
  return name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function formatRange(from, to) {
  const f = new Date(from)
  const t = new Date(to)
  const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return f.toDateString() === t.toDateString() ? fmt(f) : `${fmt(f)} – ${fmt(t)}`
}

/**
 * PendingLeaveRequestsTable — actionable queue of leave requests awaiting
 * an approve / reject decision.
 *
 * Backed by the real leave.service. Approve is optimistic — we fire the call
 * and remove the row so the queue shrinks as the admin works through it; a
 * failed call (e.g. the self-approval guard) restores the row and surfaces
 * the reason. Reject needs a reason, so it routes through RejectLeaveModal.
 */
function PendingLeaveRequestsTable({ delay = 0 }) {
  const [rows, setRows] = useState([])
  const [pendingId, setPendingId] = useState(null)
  const [error, setError] = useState(null)
  const [rejectTarget, setRejectTarget] = useState(null)

  useEffect(() => {
    let alive = true
    getPendingLeaveRequests({ limit: 6 })
      .then((res) => alive && setRows(res.data ?? []))
      .catch(() => alive && setRows([]))
    return () => {
      alive = false
    }
  }, [])

  async function handleApprove(id) {
    setPendingId(id)
    setError(null)
    try {
      await approveLeaveRequest(id)
      setRows((prev) => prev.filter((r) => r.id !== id))
    } catch (err) {
      setError(err?.message ?? 'Could not approve the request.')
    } finally {
      setPendingId(null)
    }
  }

  async function handleRejectConfirm(reason) {
    const id = rejectTarget.id
    await rejectLeaveRequest(id, reason)
    setRows((prev) => prev.filter((r) => r.id !== id))
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
      className="flex h-full flex-col gap-4 rounded-[16px] border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,20,25,0.04)]"
      aria-label="Pending leave requests"
    >
      <header className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
            Pending leave requests
          </p>
          <p className="m-0 mt-1 text-[0.85rem] text-[#4A5568]">
            {rows.length} awaiting your decision
          </p>
        </div>
        <a
          href="/admin/leave"
          className="text-[0.75rem] font-medium text-[#2C5EF5] hover:text-[#1E47C9]"
        >
          View all
        </a>
      </header>

      {error ? (
        <p className="m-0 rounded-[8px] bg-red-50 px-3 py-2 text-[0.8rem] text-red-700">
          {error}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 rounded-[12px] border border-dashed border-slate-200 bg-slate-50/40 px-4 py-10 text-center">
          <p className="m-0 text-[0.95rem] font-semibold text-[#0F1419]">All caught up.</p>
          <p className="m-0 text-[0.85rem] text-[#4A5568]">
            No pending leave requests right now.
          </p>
        </div>
      ) : (
        <ul className="m-0 flex flex-col gap-2 p-0">
          <AnimatePresence initial={false}>
            {rows.map((r) => {
              const isPending = pendingId === r.id
              const name = r.employee?.profile?.full_name ?? 'Unnamed'
              return (
                <motion.li
                  key={r.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 16, transition: { duration: 0.18 } }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className="flex flex-wrap items-center gap-3 rounded-[12px] border border-slate-200 bg-white p-3 max-[640px]:flex-col max-[640px]:items-stretch"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0F1419]/[0.06] text-[0.75rem] font-semibold text-[#0F1419] [font-family:'Geist_Mono',monospace]"
                      aria-hidden="true"
                    >
                      {initials(name)}
                    </span>
                    <div className="min-w-0">
                      <p className="m-0 truncate text-[0.9rem] font-semibold text-[#0F1419]">
                        {name}
                      </p>
                      <p className="m-0 truncate text-[0.8rem] text-[#4A5568]">
                        {formatRange(r.start_date, r.end_date)} · {r.days} {r.days === 1 ? 'day' : 'days'}
                      </p>
                    </div>
                  </div>

                  <StatusBadge value={r.leave_type} />

                  <div className="flex items-center gap-2 max-[640px]:w-full">
                    <button
                      type="button"
                      onClick={() => setRejectTarget(r)}
                      disabled={isPending}
                      className="inline-flex h-9 items-center gap-1 rounded-[8px] border border-slate-200 bg-white px-3 text-[0.78rem] font-medium text-[#4A5568] transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 max-[640px]:flex-1 max-[640px]:justify-center"
                    >
                      <X size={14} strokeWidth={2.25} aria-hidden="true" />
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApprove(r.id)}
                      disabled={isPending}
                      className="inline-flex h-9 items-center gap-1 rounded-[8px] bg-[#2C5EF5] px-3 text-[0.78rem] font-semibold text-white transition-colors hover:bg-[#1E47C9] disabled:cursor-not-allowed disabled:opacity-60 max-[640px]:flex-1 max-[640px]:justify-center"
                    >
                      <Check size={14} strokeWidth={2.5} aria-hidden="true" />
                      Approve
                    </button>
                  </div>
                </motion.li>
              )
            })}
          </AnimatePresence>
        </ul>
      )}

      <RejectLeaveModal
        open={Boolean(rejectTarget)}
        onClose={() => setRejectTarget(null)}
        request={rejectTarget}
        onConfirm={handleRejectConfirm}
      />
    </motion.section>
  )
}

export default PendingLeaveRequestsTable
