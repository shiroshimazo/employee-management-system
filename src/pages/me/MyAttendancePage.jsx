import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { CalendarDays, Clock4, MinusCircle, UserMinus } from 'lucide-react'
import AdminLayout from '../../layouts/AdminLayout.jsx'
import StatusBadge from '../../components/common/StatusBadge.jsx'
import AttendanceClockCard from '../../components/attendance/AttendanceClockCard.jsx'
import AttendanceToolbar from '../../components/attendance/AttendanceToolbar.jsx'
import {
  clockIn,
  clockOut,
  getAttendanceByEmployee,
  getAttendanceStats,
  getTodayAttendance,
} from '../../services/attendance.service.js'
import { useAuth } from '../../hooks/useAuth.js'
import { supabase } from '../../lib/supabase.js'

/**
 * MyAttendancePage — employee-facing view of their own attendance.
 *
 * Flow:
 *   1. resolve the caller's employees.id once on mount (service keys off
 *      employee_id, not profile_id)
 *   2. load today's row → drives the clock card's mode (in vs out vs done)
 *   3. load monthly stats + the punch history with optional date-range filter
 *
 * RLS guarantees this view only ever shows the caller's own rows; even a
 * misbehaving filter can't leak someone else's data.
 *
 * Reuses AdminLayout — it's the app shell with the sidebar + auth gate;
 * nothing about it is admin-specific.
 */

function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function MyAttendancePage() {
  const { user } = useAuth()

  const [employeeId, setEmployeeId] = useState(null)
  const [employeeError, setEmployeeError] = useState(null)

  const [today, setToday] = useState(null)
  const [stats, setStats] = useState(null)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Toolbar state — employees scan their own short history visually, so
  // we hide search + status. The date range is the useful knob.
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const reqTokenRef = useRef(0)

  // Resolve current user's employees.id once.
  useEffect(() => {
    if (!user?.id) return
    let alive = true
    supabase
      .from('employees')
      .select('id')
      .eq('profile_id', user.id)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (!alive) return
        if (err) {
          setEmployeeError(err.message)
          return
        }
        setEmployeeId(data?.id ?? null)
      })
    return () => {
      alive = false
    }
  }, [user?.id])

  const refreshTodayAndStats = useCallback(async () => {
    if (!employeeId) return
    const [todayRow, monthly] = await Promise.all([
      getTodayAttendance(employeeId).catch(() => null),
      getAttendanceStats({ employeeId }).catch(() => null),
    ])
    setToday(todayRow)
    setStats(monthly)
  }, [employeeId])

  const load = useCallback(async () => {
    if (!employeeId) return
    const token = ++reqTokenRef.current
    setLoading(true)
    setError(null)
    try {
      const [todayRow, monthly, history] = await Promise.all([
        getTodayAttendance(employeeId),
        getAttendanceStats({ employeeId }),
        getAttendanceByEmployee(employeeId, {
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        }),
      ])
      if (token !== reqTokenRef.current) return
      setToday(todayRow)
      setStats(monthly)
      setRows(history.data ?? [])
    } catch (err) {
      if (token !== reqTokenRef.current) return
      setError(err?.message ?? 'Failed to load your attendance.')
      setRows([])
    } finally {
      if (token === reqTokenRef.current) setLoading(false)
    }
  }, [employeeId, startDate, endDate])

  useEffect(() => {
    if (employeeId) load()
  }, [load, employeeId])

  async function handleClockIn() {
    const updated = await clockIn(employeeId)
    setToday(updated)
    // Prepend or replace today's row in the history without a full refetch.
    setRows((prev) => {
      const filtered = prev.filter((r) => r.id !== updated.id)
      return [updated, ...filtered]
    })
    // Stats might shift (a missing day becomes a present day).
    refreshTodayAndStats()
  }

  async function handleClockOut() {
    const updated = await clockOut(employeeId)
    setToday(updated)
    setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
    refreshTodayAndStats()
  }

  const noEmployeeRecord = user?.id && employeeId === null && !employeeError

  const monthLabel = useMemo(
    () =>
      new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    [],
  )

  return (
    <AdminLayout>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="m-0 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
            Attendance
          </p>
          <h1 className="m-0 mt-2 text-[2rem] font-bold leading-[1.1] tracking-[-0.01em] text-[#0F1419] max-[600px]:text-[1.6rem]">
            My attendance
          </h1>
          <p className="mb-0 mt-2 text-[0.95rem] leading-snug text-[#4A5568]">
            Clock in for the day, see your history, and check this month's totals.
          </p>
        </div>
      </header>

      {employeeError ? (
        <p className="mt-2 rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-[0.85rem] text-red-700">
          {employeeError}
        </p>
      ) : null}
      {noEmployeeRecord ? (
        <p className="mt-2 rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2 text-[0.85rem] text-amber-800">
          We couldn't find an employee record for your account yet. Reach out to
          HR — once the record exists, this page will pick it up.
        </p>
      ) : null}

      {/* Top: clock card on the left, monthly stats on the right. */}
      <section className="grid grid-cols-3 gap-4 max-[900px]:grid-cols-1">
        <div className="col-span-1 max-[900px]:col-span-1">
          <AttendanceClockCard
            today={today}
            onClockIn={handleClockIn}
            onClockOut={handleClockOut}
            disabled={!employeeId}
          />
        </div>

        <div className="col-span-2 max-[900px]:col-span-1">
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="flex h-full flex-col gap-4 rounded-[16px] border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,20,25,0.04)]"
            aria-label="This month's totals"
          >
            <header className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="m-0 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
                  This month
                </p>
                <p className="m-0 mt-1 text-[0.85rem] text-[#4A5568]">{monthLabel}</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-[8px] bg-slate-100 px-2 py-1 text-[0.7rem] font-medium text-[#4A5568] [font-family:'Geist_Mono',monospace]">
                <Clock4 size={12} strokeWidth={2.25} aria-hidden="true" />
                {stats?.total_hours ?? 0}h logged
              </span>
            </header>

            <div className="grid grid-cols-4 gap-3 max-[600px]:grid-cols-2">
              <StatTile
                icon={CalendarDays}
                tone="bg-emerald-50 text-emerald-700"
                label="Present"
                value={stats?.present ?? 0}
              />
              <StatTile
                icon={Clock4}
                tone="bg-amber-50 text-amber-700"
                label="Late"
                value={stats?.late ?? 0}
              />
              <StatTile
                icon={MinusCircle}
                tone="bg-blue-50 text-blue-700"
                label="On leave"
                value={stats?.leave ?? 0}
              />
              <StatTile
                icon={UserMinus}
                tone="bg-red-50 text-red-700"
                label="Absent"
                value={stats?.absent ?? 0}
              />
            </div>
          </motion.section>
        </div>
      </section>

      <div className="mt-4">
        <AttendanceToolbar
          showSearch={false}
          showStatus={false}
          showDepartment={false}
          startDate={startDate}
          onStartDateChange={setStartDate}
          endDate={endDate}
          onEndDateChange={setEndDate}
        />
      </div>

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
        aria-label="My attendance history"
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left">
                {['Date', 'Clock in', 'Clock out', 'Hours', 'Status', 'Remarks'].map(
                  (h, i) => (
                    <th
                      key={i}
                      className="border-b border-slate-200 bg-slate-50/60 px-4 py-3 text-[0.65rem] font-medium uppercase tracking-[0.1em] text-[#4A5568] [font-family:'Geist_Mono',monospace]"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-[0.85rem] text-[#4A5568]">
                    Loading your attendance…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center">
                    <p className="m-0 text-[0.95rem] font-semibold text-[#0F1419]">
                      No records yet.
                    </p>
                    <p className="m-0 mt-1 text-[0.85rem] text-[#4A5568]">
                      Clock in to start your first day.
                    </p>
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="transition-colors hover:bg-slate-50/60">
                    <td className="px-4 py-3 text-[0.85rem] text-[#0F1419] [font-family:'Geist_Mono',monospace]">
                      {fmtDate(r.date)}
                    </td>
                    <td className="px-4 py-3 text-[0.8rem] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
                      {fmtTime(r.check_in)}
                    </td>
                    <td className="px-4 py-3 text-[0.8rem] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
                      {fmtTime(r.check_out)}
                    </td>
                    <td className="px-4 py-3 text-[0.85rem] text-[#0F1419] [font-family:'Geist_Mono',monospace]">
                      {r.total_hours != null ? `${r.total_hours}h` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge value={r.status} />
                    </td>
                    <td className="max-w-[260px] px-4 py-3 text-[0.85rem] text-[#4A5568]">
                      <span className="line-clamp-2">{r.notes ?? '—'}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.section>
    </AdminLayout>
  )
}

function StatTile({ icon: Icon, tone, label, value }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-[12px] border border-slate-200 bg-white p-3">
      <div className="min-w-0">
        <p className="m-0 text-[0.65rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
          {label}
        </p>
        <p className="m-0 mt-1 text-[1.4rem] font-bold leading-none text-[#0F1419] [font-family:'Geist',sans-serif]">
          {value}
        </p>
      </div>
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] ${tone}`}
        aria-hidden="true"
      >
        <Icon size={14} strokeWidth={2} />
      </span>
    </div>
  )
}

export default MyAttendancePage
