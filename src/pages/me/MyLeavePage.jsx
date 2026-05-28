import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Calendar, Eye, Plus, X } from 'lucide-react'
import AdminLayout from '../../layouts/AdminLayout.jsx'
import StatusBadge from '../../components/common/StatusBadge.jsx'
import LeaveToolbar from '../../components/leave/LeaveToolbar.jsx'
import LeaveRequestFormModal from '../../components/leave/LeaveRequestFormModal.jsx'
import LeaveDetailModal from '../../components/leave/LeaveDetailModal.jsx'
import {
  cancelLeaveRequest,
  createLeaveRequest,
  getLeaveRequestsByEmployee,
} from '../../services/leave.service.js'
import { useAuth } from '../../hooks/useAuth.js'
import { supabase } from '../../lib/supabase.js'

/**
 * MyLeavePage — employee-facing view of their own leave activity.
 *
 * Flow:
 *   - resolve the caller's employees.id once on mount (the leave service
 *     keys off employee_id, not profile_id, so we need the join)
 *   - load that employee's leave history with type / date-range filters
 *   - "Submit request" opens the shared LeaveRequestFormModal
 *   - pending rows can be cancelled inline; everything else is read-only
 *
 * RLS handles authorization: the employee can only ever see/write their own
 * rows here, even if the page somehow tried to ask for someone else's.
 *
 * Reuses AdminLayout intentionally — it's just the app shell with the
 * sidebar and the auth gate; nothing about it is admin-specific.
 */

function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function MyLeavePage() {
  const { user } = useAuth()

  const [employeeId, setEmployeeId] = useState(null)
  const [employeeError, setEmployeeError] = useState(null)

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Toolbar state — employee view doesn't need a status filter (they want
  // to see their full history by default), so we hide it.
  const [leaveType, setLeaveType] = useState('')
  const [startFrom, setStartFrom] = useState('')
  const [startTo, setStartTo] = useState('')

  // Modal state
  const [submitOpen, setSubmitOpen] = useState(false)
  const [detailTarget, setDetailTarget] = useState(null)

  // Per-row pending flag for cancel; modal flow has its own.
  const [pendingId, setPendingId] = useState(null)

  const reqTokenRef = useRef(0)

  // Resolve the current user's employees.id row. We keep the lookup in this
  // file because no other page needs it yet — promote to a hook (e.g.
  // useCurrentEmployee()) when the second consumer shows up.
  useEffect(() => {
    if (!user?.id) return
    let alive = true
    supabase
      .from('employees')
      .select('id')
      .eq('profile_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return
        if (error) {
          setEmployeeError(error.message)
          return
        }
        setEmployeeId(data?.id ?? null)
      })
    return () => {
      alive = false
    }
  }, [user?.id])

  const load = useCallback(async () => {
    if (!employeeId) return
    const token = ++reqTokenRef.current
    setLoading(true)
    setError(null)
    try {
      const result = await getLeaveRequestsByEmployee(employeeId, {
        leaveType: leaveType || undefined,
        startFrom: startFrom || undefined,
        startTo: startTo || undefined,
      })
      if (token !== reqTokenRef.current) return
      setRows(result.data ?? [])
    } catch (err) {
      if (token !== reqTokenRef.current) return
      setError(err?.message ?? 'Failed to load your leave history.')
      setRows([])
    } finally {
      if (token === reqTokenRef.current) setLoading(false)
    }
  }, [employeeId, leaveType, startFrom, startTo])

  useEffect(() => {
    if (employeeId) load()
  }, [load, employeeId])

  const stats = useMemo(() => {
    const tally = { pending: 0, approved: 0, rejected: 0, cancelled: 0, daysApproved: 0 }
    for (const r of rows) {
      tally[r.status] = (tally[r.status] ?? 0) + 1
      if (r.status === 'approved') tally.daysApproved += Number(r.days ?? 0)
    }
    return tally
  }, [rows])

  async function handleSubmit(payload) {
    const created = await createLeaveRequest(payload)
    setRows((prev) => [created, ...prev])
  }

  async function handleCancel(row) {
    if (!confirm('Cancel this leave request? This cannot be undone.')) return
    setPendingId(row.id)
    try {
      const updated = await cancelLeaveRequest(row.id)
      setRows((prev) => prev.map((r) => (r.id === row.id ? updated : r)))
    } catch (err) {
      setError(err?.message ?? 'Could not cancel the request.')
    } finally {
      setPendingId(null)
    }
  }

  // The page should still render gracefully if the auth user has a profile
  // but no employees row yet (admin hasn't onboarded them). We surface a
  // helpful message in that case rather than a silent empty list.
  const noEmployeeRecord = user?.id && employeeId === null && !employeeError

  return (
    <AdminLayout>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="m-0 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
            Leave
          </p>
          <h1 className="m-0 mt-2 text-[2rem] font-bold leading-[1.1] tracking-[-0.01em] text-[#0F1419] max-[600px]:text-[1.6rem]">
            My leave requests
          </h1>
          <p className="mb-0 mt-2 text-[0.95rem] leading-snug text-[#4A5568]">
            Submit time off and track your past requests.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSubmitOpen(true)}
          disabled={!employeeId}
          className="inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-[#2C5EF5] px-3 text-[0.8rem] font-semibold text-white transition-colors hover:bg-[#1E47C9] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Plus size={14} strokeWidth={2.5} aria-hidden="true" />
          Submit request
        </button>
      </header>

      {/* Quick stats */}
      <section
        aria-label="Leave summary"
        className="mb-4 grid grid-cols-4 gap-3 max-[900px]:grid-cols-2 max-[480px]:grid-cols-1"
      >
        <StatTile label="Pending" value={stats.pending} />
        <StatTile label="Approved" value={stats.approved} />
        <StatTile label="Days approved" value={stats.daysApproved} />
        <StatTile label="Rejected / cancelled" value={stats.rejected + stats.cancelled} />
      </section>

      <LeaveToolbar
        leaveType={leaveType}
        onLeaveTypeChange={setLeaveType}
        startFrom={startFrom}
        onStartFromChange={setStartFrom}
        startTo={startTo}
        onStartToChange={setStartTo}
        // Hide search + status; employees scan their own short history visually.
        showStatus={false}
        query=""
        onQueryChange={() => {}}
      />

      {employeeError ? (
        <p className="mt-4 rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-[0.85rem] text-red-700">
          {employeeError}
        </p>
      ) : null}
      {noEmployeeRecord ? (
        <p className="mt-4 rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2 text-[0.85rem] text-amber-800">
          We couldn't find an employee record for your account yet. Reach out to
          HR to get onboarded — once the record exists, this page will pick it up.
        </p>
      ) : null}
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
        aria-label="My leave requests"
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left">
                {['Type', 'Dates', 'Days', 'Reason', 'Status', 'Submitted', ''].map((h, i) => (
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
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-[0.85rem] text-[#4A5568]"
                  >
                    Loading your requests…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center">
                    <p className="m-0 text-[0.95rem] font-semibold text-[#0F1419]">
                      No leave requests yet.
                    </p>
                    <p className="m-0 mt-1 text-[0.85rem] text-[#4A5568]">
                      Hit "Submit request" to file your first one.
                    </p>
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const isPending = r.status === 'pending'
                  const rowBusy = pendingId === r.id
                  return (
                    <tr key={r.id} className="transition-colors hover:bg-slate-50/60">
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
                      <td className="px-4 py-3 text-[0.8rem] text-[#94A3B8] [font-family:'Geist_Mono',monospace]">
                        {fmtDate(r.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setDetailTarget(r)}
                            aria-label="View request details"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-[#4A5568] transition-colors hover:bg-slate-100 hover:text-[#0F1419]"
                          >
                            <Eye size={14} strokeWidth={2} />
                          </button>
                          {isPending ? (
                            <button
                              type="button"
                              onClick={() => handleCancel(r)}
                              disabled={rowBusy}
                              aria-label="Cancel pending request"
                              className="inline-flex h-8 items-center gap-1 rounded-[8px] border border-slate-200 bg-white px-2 text-[0.75rem] font-medium text-[#4A5568] transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <X size={12} strokeWidth={2.25} />
                              Cancel
                            </button>
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

      <LeaveRequestFormModal
        open={submitOpen}
        onClose={() => setSubmitOpen(false)}
        mode="create"
        employeeId={employeeId}
        onSubmit={handleSubmit}
      />

      <LeaveDetailModal
        open={Boolean(detailTarget)}
        onClose={() => setDetailTarget(null)}
        request={detailTarget}
      />
    </AdminLayout>
  )
}

function StatTile({ label, value }) {
  return (
    <div className="flex flex-col gap-1 rounded-[12px] border border-slate-200 bg-white p-4 shadow-[0_4px_12px_rgba(15,20,25,0.03)]">
      <span className="text-[0.65rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
        {label}
      </span>
      <span className="text-[1.5rem] font-bold leading-none text-[#0F1419] [font-family:'Geist',sans-serif]">
        {value}
      </span>
    </div>
  )
}

export default MyLeavePage
