import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Calendar, Check, Eye, Users, X } from 'lucide-react'
import AdminLayout from '../../layouts/AdminLayout.jsx'
import { LoadingState } from '../../components/common/LoadingBars.jsx'
import StatusBadge from '../../components/common/StatusBadge.jsx'
import LeaveToolbar from '../../components/leave/LeaveToolbar.jsx'
import LeaveDetailModal from '../../components/leave/LeaveDetailModal.jsx'
import RejectLeaveModal from '../../components/leave/RejectLeaveModal.jsx'
import {
  approveLeaveRequest,
  getLeaveRequests,
  rejectLeaveRequest,
  searchLeaveRequests,
} from '../../services/leave.service.js'

/**
 * TeamLeavePage — manager view of leave requests from their team.
 *
 * RLS does the heavy lifting:
 *   leave_requests_select_manager  → manager sees their team's requests
 *   leave_requests_update_manager  → manager can decide on those requests
 *
 * That means we can reuse getLeaveRequests / approve / reject directly.
 * No client-side "is this person on my team?" check is needed; the DB
 * scopes the query for us.
 *
 * Defaults to the pending tab so a manager lands on actionable work first;
 * a one-click toggle flips between Pending / All for the rest of the team's
 * history.
 */

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

function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function TeamLeavePage() {
  const [rows, setRows] = useState([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Toolbar state. Default to pending so the queue is the first thing
  // a manager sees — that's the actionable view.
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('pending')
  const [leaveType, setLeaveType] = useState('')
  const [startFrom, setStartFrom] = useState('')
  const [startTo, setStartTo] = useState('')

  // Modal state
  const [detailTarget, setDetailTarget] = useState(null)
  const [rejectTarget, setRejectTarget] = useState(null)

  const [pendingId, setPendingId] = useState(null)
  const reqTokenRef = useRef(0)

  const load = useCallback(async () => {
    const token = ++reqTokenRef.current
    setLoading(true)
    setError(null)
    try {
      let result
      if (query.trim()) {
        result = await searchLeaveRequests(query)
        result = {
          ...result,
          data: result.data.filter((r) => {
            if (status && r.status !== status) return false
            if (leaveType && r.leave_type !== leaveType) return false
            if (startFrom && r.start_date < startFrom) return false
            if (startTo && r.start_date > startTo) return false
            return true
          }),
        }
      } else {
        result = await getLeaveRequests({
          status: status || undefined,
          leaveType: leaveType || undefined,
          startFrom: startFrom || undefined,
          startTo: startTo || undefined,
        })
      }
      if (token !== reqTokenRef.current) return
      setRows(result.data ?? [])
      setCount(result.count ?? result.data?.length ?? 0)
    } catch (err) {
      if (token !== reqTokenRef.current) return
      setError(err?.message ?? 'Failed to load your team\'s leave requests.')
      setRows([])
      setCount(0)
    } finally {
      if (token === reqTokenRef.current) setLoading(false)
    }
  }, [query, status, leaveType, startFrom, startTo])

  useEffect(() => {
    const t = setTimeout(load, query.trim() ? 220 : 0)
    return () => clearTimeout(t)
  }, [load, query])

  const visibleCount = rows.length
  const totalLabel = useMemo(() => {
    if (loading) {
      return <LoadingState label="Loading" barsClassName="h-3 w-5" />
    }
    if (count === visibleCount) {
      return `${count} ${count === 1 ? 'request' : 'requests'}`
    }
    return `${visibleCount} of ${count} requests`
  }, [loading, count, visibleCount])

  async function handleApprove(row) {
    setPendingId(row.id)
    try {
      const updated = await approveLeaveRequest(row.id)
      setRows((prev) => prev.map((r) => (r.id === row.id ? updated : r)))
    } catch (err) {
      setError(err?.message ?? 'Could not approve the request.')
    } finally {
      setPendingId(null)
    }
  }

  async function handleReject(reason) {
    if (!rejectTarget) return
    const id = rejectTarget.id
    setPendingId(id)
    try {
      const updated = await rejectLeaveRequest(id, reason)
      setRows((prev) => prev.map((r) => (r.id === id ? updated : r)))
    } finally {
      setPendingId(null)
    }
  }

  return (
    <AdminLayout>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="m-0 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
            Team
          </p>
          <h1 className="m-0 mt-2 text-[2rem] font-bold leading-[1.1] tracking-[-0.01em] text-[#0F1419] max-[600px]:text-[1.6rem]">
            Team leave requests
          </h1>
          <p className="mb-0 mt-2 text-[0.95rem] leading-snug text-[#4A5568]">
            Approve or reject leave requests from people you manage.
          </p>
        </div>
        <span
          className="inline-flex items-center gap-2 rounded-[10px] bg-white px-3 py-2 text-[0.75rem] font-medium text-[#4A5568] shadow-[0_4px_12px_rgba(15,20,25,0.04)] [font-family:'Geist_Mono',monospace]"
          aria-label="Total team requests"
        >
          <Users size={12} strokeWidth={2.25} aria-hidden="true" />
          {totalLabel}
        </span>
      </header>

      {/* Quick "Pending only" / "All" tab pair so managers can move from
          the actionable view to the wider history without clearing the
          status select manually. */}
      <div className="mb-3 inline-flex items-center gap-1 rounded-[10px] border border-slate-200 bg-white p-1 shadow-[0_4px_12px_rgba(15,20,25,0.04)]">
        <Tab active={status === 'pending'} onClick={() => setStatus('pending')}>
          <Calendar size={12} strokeWidth={2.25} aria-hidden="true" />
          Pending
        </Tab>
        <Tab active={status === ''} onClick={() => setStatus('')}>
          All
        </Tab>
      </div>

      <LeaveToolbar
        query={query}
        onQueryChange={setQuery}
        status={status}
        onStatusChange={setStatus}
        leaveType={leaveType}
        onLeaveTypeChange={setLeaveType}
        startFrom={startFrom}
        onStartFromChange={setStartFrom}
        startTo={startTo}
        onStartToChange={setStartTo}
      />

      {error ? (
        <p className="mt-4 rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-[0.85rem] text-red-700">
          {error}
        </p>
      ) : null}

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="mt-4 overflow-hidden rounded-[16px] border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,20,25,0.04)]"
        aria-label="Team leave requests"
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left">
                {['Employee', 'Type', 'Dates', 'Days', 'Reason', 'Status', ''].map((h, i) => (
                  <th
                    key={i}
                    className="border-b border-slate-200 bg-slate-50/60 px-4 py-3 text-[0.65rem] font-medium uppercase tracking-[0.1em] text-[#4A5568] [font-family:'Geist_Mono',monospace]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-[0.85rem] text-[#4A5568]">
                    <LoadingState label="Loading team requests" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center">
                    <p className="m-0 text-[0.95rem] font-semibold text-[#0F1419]">
                      {status === 'pending' ? 'All caught up.' : 'No team requests match.'}
                    </p>
                    <p className="m-0 mt-1 text-[0.85rem] text-[#4A5568]">
                      {status === 'pending'
                        ? 'No pending requests from your team right now.'
                        : 'Try clearing filters or widening the date range.'}
                    </p>
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const name = r.employee?.profile?.full_name ?? 'Unnamed'
                  const dept = r.employee?.department?.name
                  const isPending = r.status === 'pending'
                  const rowBusy = pendingId === r.id
                  return (
                    <tr key={r.id} className="transition-colors hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2C5EF5]/10 text-[0.7rem] font-semibold text-[#2C5EF5] [font-family:'Geist_Mono',monospace]"
                            aria-hidden="true"
                          >
                            {initials(name)}
                          </span>
                          <div className="min-w-0">
                            <p className="m-0 truncate text-[0.9rem] font-medium text-[#0F1419]">
                              {name}
                            </p>
                            <p className="m-0 truncate text-[0.75rem] text-[#94A3B8]">
                              {dept ?? r.employee?.employee_number ?? '—'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge value={r.leave_type} />
                      </td>
                      <td className="px-4 py-3 text-[0.8rem] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
                        {fmtDate(r.start_date)} → {fmtDate(r.end_date)}
                      </td>
                      <td className="px-4 py-3 text-[0.85rem] text-[#0F1419] [font-family:'Geist_Mono',monospace]">
                        {r.days ?? '—'}
                      </td>
                      <td className="max-w-[260px] px-4 py-3 text-[0.85rem] text-[#4A5568]">
                        <span className="line-clamp-2">{r.reason ?? '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge value={r.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setDetailTarget(r)}
                            aria-label={`View ${name}'s request`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-[#4A5568] transition-colors hover:bg-slate-100 hover:text-[#0F1419]"
                          >
                            <Eye size={14} strokeWidth={2} />
                          </button>
                          {isPending ? (
                            <>
                              <button
                                type="button"
                                onClick={() => setRejectTarget(r)}
                                disabled={rowBusy}
                                aria-label={`Reject ${name}'s request`}
                                className="inline-flex h-8 items-center gap-1 rounded-[8px] border border-slate-200 bg-white px-2 text-[0.75rem] font-medium text-[#4A5568] transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <X size={12} strokeWidth={2.25} />
                                Reject
                              </button>
                              <button
                                type="button"
                                onClick={() => handleApprove(r)}
                                disabled={rowBusy}
                                aria-label={`Approve ${name}'s request`}
                                className="inline-flex h-8 items-center gap-1 rounded-[8px] bg-[#2C5EF5] px-2 text-[0.75rem] font-semibold text-white transition-colors hover:bg-[#1E47C9] disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <Check size={12} strokeWidth={2.5} />
                                Approve
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </motion.section>

      <LeaveDetailModal
        open={Boolean(detailTarget)}
        onClose={() => setDetailTarget(null)}
        request={detailTarget}
      />

      <RejectLeaveModal
        open={Boolean(rejectTarget)}
        onClose={() => setRejectTarget(null)}
        request={rejectTarget}
        onConfirm={handleReject}
      />
    </AdminLayout>
  )
}

function Tab({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-7 items-center gap-1.5 rounded-[8px] px-2.5 text-[0.78rem] font-medium transition-colors ${
        active
          ? 'bg-[#0F1419] text-white'
          : 'text-[#4A5568] hover:bg-slate-100 hover:text-[#0F1419]'
      }`}
    >
      {children}
    </button>
  )
}

export default TeamLeavePage
