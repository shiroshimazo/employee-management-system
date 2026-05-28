import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, X } from 'lucide-react'
import {
  approveLeaveRequest,
  getPendingLeaveRequests,
  rejectLeaveRequest,
} from '../../services/dashboardService.js'

const TYPE_TONE = {
  Vacation: 'bg-blue-50 text-blue-700',
  Sick: 'bg-amber-50 text-amber-700',
  Personal: 'bg-teal-50 text-teal-700',
  Bereavement: 'bg-slate-100 text-slate-600',
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
 * Each action is optimistic: we fire the service call and remove the row
 * immediately so the queue shrinks as the admin works through it. Failed
 * mutations would put the row back; today the mock service always succeeds.
 */
function PendingLeaveRequestsTable({ delay = 0 }) {
  const [rows, setRows] = useState([])
  const [pendingId, setPendingId] = useState(null)

  useEffect(() => {
    let alive = true
    getPendingLeaveRequests().then((d) => alive && setRows(d))
    return () => {
      alive = false
    }
  }, [])

  async function handleApprove(id) {
    setPendingId(id)
    try {
      await approveLeaveRequest(id)
      setRows((prev) => prev.filter((r) => r.id !== id))
    } finally {
      setPendingId(null)
    }
  }

  async function handleReject(id) {
    setPendingId(id)
    try {
      await rejectLeaveRequest(id)
      setRows((prev) => prev.filter((r) => r.id !== id))
    } finally {
      setPendingId(null)
    }
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
      </header>

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
                      {r.avatarSeed}
                    </span>
                    <div className="min-w-0">
                      <p className="m-0 truncate text-[0.9rem] font-semibold text-[#0F1419]">
                        {r.employee}
                      </p>
                      <p className="m-0 truncate text-[0.8rem] text-[#4A5568]">
                        {formatRange(r.from, r.to)} · {r.days} {r.days === 1 ? 'day' : 'days'}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center rounded-[6px] px-2 py-1 text-[0.7rem] font-semibold ${
                      TYPE_TONE[r.type] ?? 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {r.type}
                  </span>

                  <div className="flex items-center gap-2 max-[640px]:w-full">
                    <button
                      type="button"
                      onClick={() => handleReject(r.id)}
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
    </motion.section>
  )
}

export default PendingLeaveRequestsTable
