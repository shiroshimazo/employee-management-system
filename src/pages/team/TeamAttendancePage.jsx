import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Eye, Users } from 'lucide-react'
import AdminLayout from '../../layouts/AdminLayout.jsx'
import { LoadingState } from '../../components/common/LoadingBars.jsx'
import StatusBadge from '../../components/common/StatusBadge.jsx'
import AttendanceToolbar from '../../components/attendance/AttendanceToolbar.jsx'
import AttendanceSummaryCards from '../../components/attendance/AttendanceSummaryCards.jsx'
import {
  getAttendanceRecords,
  getTodayAttendanceSummary,
  todayLocalISO,
} from '../../services/attendance.service.js'
import { getDepartments } from '../../services/department.service.js'

/**
 * TeamAttendancePage — manager view of their team's attendance.
 *
 * RLS does the heavy lifting:
 *   attendance_select_manager → manager sees their team's records
 *   (no write policy for managers; this page is read-only.)
 *
 * Layout:
 *   1. Today's summary cards — team-scoped automatically (the same query
 *      runs for every role, RLS narrows the result).
 *   2. Three "bucket" sections for *today*: Present · Late · Absent — the
 *      "who's missing this morning?" quick-scan. Computed from today's
 *      rows; "absent" intentionally only reflects rows tagged absent
 *      (we can't list "people without records" without a separate query
 *      against employees, which is overkill for a sidebar).
 *   3. Filterable history table for any wider lookup.
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

function fmtTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function TeamAttendancePage() {
  const [rows, setRows] = useState([])
  const [count, setCount] = useState(0)
  const [todayRows, setTodayRows] = useState([])
  const [summary, setSummary] = useState(null)
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Toolbar state
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const reqTokenRef = useRef(0)

  const load = useCallback(async () => {
    const token = ++reqTokenRef.current
    setLoading(true)
    setError(null)
    try {
      const result = await getAttendanceRecords({
        status: status || undefined,
        departmentId: departmentId || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      })
      if (token !== reqTokenRef.current) return
      let data = result.data ?? []
      if (query.trim()) {
        const term = query.trim().toLowerCase()
        data = data.filter((r) =>
          (r.employee?.profile?.full_name ?? '').toLowerCase().includes(term),
        )
      }
      setRows(data)
      setCount(query.trim() ? data.length : (result.count ?? data.length))
    } catch (err) {
      if (token !== reqTokenRef.current) return
      setError(err?.message ?? 'Failed to load team attendance.')
      setRows([])
      setCount(0)
    } finally {
      if (token === reqTokenRef.current) setLoading(false)
    }
  }, [query, status, departmentId, startDate, endDate])

  useEffect(() => {
    const t = setTimeout(load, query.trim() ? 220 : 0)
    return () => clearTimeout(t)
  }, [load, query])

  // Today's rows + summary + departments load once on mount. Today drives
  // the three bucket sections; it's independent from the filter bar that
  // scopes the history table below.
  useEffect(() => {
    let alive = true
    const today = todayLocalISO()
    Promise.all([
      getAttendanceRecords({ startDate: today, endDate: today, limit: 500 }),
      getTodayAttendanceSummary().catch(() => null),
      getDepartments(),
    ])
      .then(([att, s, depts]) => {
        if (!alive) return
        setTodayRows(att?.data ?? [])
        setSummary(s)
        setDepartments(depts?.data ?? [])
      })
      .catch(() => {
        if (alive) {
          setTodayRows([])
          setDepartments([])
        }
      })
    return () => {
      alive = false
    }
  }, [])

  // Bucket today's rows by status. We compute once per todayRows change so
  // the three sections render off the same memoized result.
  const buckets = useMemo(() => {
    const out = { present: [], late: [], absent: [] }
    for (const r of todayRows) {
      if (r.status === 'present' || r.status === 'remote' || r.status === 'half_day') {
        out.present.push(r)
      } else if (r.status === 'late') {
        out.late.push(r)
      } else if (r.status === 'absent') {
        out.absent.push(r)
      }
    }
    return out
  }, [todayRows])

  const visibleCount = rows.length
  const totalLabel = useMemo(() => {
    if (loading) {
      return <LoadingState label="Loading" barsClassName="h-3 w-5" />
    }
    if (count === visibleCount) {
      return `${count} ${count === 1 ? 'record' : 'records'}`
    }
    return `${visibleCount} of ${count} records`
  }, [loading, count, visibleCount])

  return (
    <AdminLayout>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="m-0 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
            Team
          </p>
          <h1 className="m-0 mt-2 text-[2rem] font-bold leading-[1.1] tracking-[-0.01em] text-[#0F1419] max-[600px]:text-[1.6rem]">
            Team attendance
          </h1>
          <p className="mb-0 mt-2 text-[0.95rem] leading-snug text-[#4A5568]">
            See who's clocked in today, who's late, and who's missing — across the people you manage.
          </p>
        </div>
        <span
          className="inline-flex items-center gap-2 rounded-[10px] bg-white px-3 py-2 text-[0.75rem] font-medium text-[#4A5568] shadow-[0_4px_12px_rgba(15,20,25,0.04)] [font-family:'Geist_Mono',monospace]"
          aria-label="Total records"
        >
          <Users size={12} strokeWidth={2.25} aria-hidden="true" />
          {totalLabel}
        </span>
      </header>

      <div className="mb-4">
        <AttendanceSummaryCards summary={summary} loading={!summary} />
      </div>

      {/* Three "today" buckets — the at-a-glance morning view. */}
      <section
        className="mb-4 grid grid-cols-3 gap-3 max-[900px]:grid-cols-1"
        aria-label="Today's team status"
      >
        <BucketPanel
          title="Present today"
          tone="bg-emerald-50 text-emerald-700"
          rows={buckets.present}
          emptyText="No one's clocked in yet."
        />
        <BucketPanel
          title="Late today"
          tone="bg-amber-50 text-amber-700"
          rows={buckets.late}
          emptyText="No one's late."
        />
        <BucketPanel
          title="Absent today"
          tone="bg-red-50 text-red-700"
          rows={buckets.absent}
          emptyText="No one marked absent."
        />
      </section>

      <AttendanceToolbar
        query={query}
        onQueryChange={setQuery}
        status={status}
        onStatusChange={setStatus}
        departmentId={departmentId}
        onDepartmentChange={setDepartmentId}
        departments={departments}
        startDate={startDate}
        onStartDateChange={setStartDate}
        endDate={endDate}
        onEndDateChange={setEndDate}
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
        aria-label="Team attendance history"
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left">
                {[
                  'Employee',
                  'Date',
                  'Clock in',
                  'Clock out',
                  'Hours',
                  'Status',
                  'Remarks',
                ].map((h, i) => (
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
                    <LoadingState label="Loading team attendance" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center">
                    <p className="m-0 text-[0.95rem] font-semibold text-[#0F1419]">
                      No records match.
                    </p>
                    <p className="m-0 mt-1 text-[0.85rem] text-[#4A5568]">
                      Try clearing filters or widening the date range.
                    </p>
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const name = r.employee?.profile?.full_name ?? 'Unnamed'
                  const dept = r.employee?.department?.name
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
                      <td className="px-4 py-3 text-[0.8rem] text-[#0F1419] [font-family:'Geist_Mono',monospace]">
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
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </motion.section>
    </AdminLayout>
  )
}

/**
 * BucketPanel — compact list of people in a given "today" bucket.
 *
 * Renders up to 5 rows by default; longer lists overflow inside their own
 * card so the three buckets keep equal heights at-a-glance. We skip per-row
 * actions here on purpose — a manager can dive into the history table below
 * for the full punch detail, and there's nothing they can write anyway
 * (RLS disallows manager writes on attendance).
 */
function BucketPanel({ title, tone, rows, emptyText }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="flex h-full flex-col gap-3 rounded-[16px] border border-slate-200 bg-white p-4 shadow-[0_4px_12px_rgba(15,20,25,0.03)]"
    >
      <header className="flex items-center justify-between gap-3">
        <p className="m-0 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
          {title}
        </p>
        <span
          className={`inline-flex items-center justify-center rounded-[6px] px-2 py-0.5 text-[0.7rem] font-semibold ${tone} [font-family:'Geist_Mono',monospace]`}
        >
          {rows.length}
        </span>
      </header>

      {rows.length === 0 ? (
        <p className="m-0 rounded-[8px] border border-dashed border-slate-200 bg-slate-50/40 px-3 py-4 text-center text-[0.8rem] text-[#94A3B8]">
          {emptyText}
        </p>
      ) : (
        <ul className="m-0 flex flex-col gap-2 p-0">
          {rows.slice(0, 5).map((r) => {
            const name = r.employee?.profile?.full_name ?? 'Unnamed'
            const dept = r.employee?.department?.name
            return (
              <li
                key={r.id}
                className="flex items-center gap-3 rounded-[10px] border border-slate-200 bg-white p-2"
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2C5EF5]/10 text-[0.65rem] font-semibold text-[#2C5EF5] [font-family:'Geist_Mono',monospace]"
                  aria-hidden="true"
                >
                  {initials(name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="m-0 truncate text-[0.85rem] font-medium text-[#0F1419]">
                    {name}
                  </p>
                  <p className="m-0 truncate text-[0.7rem] text-[#94A3B8] [font-family:'Geist_Mono',monospace]">
                    {dept ?? r.employee?.employee_number ?? '—'}
                    {r.check_in ? ` · ${fmtTime(r.check_in)}` : ''}
                  </p>
                </div>
              </li>
            )
          })}
          {rows.length > 5 ? (
            <li className="px-1 text-[0.75rem] text-[#94A3B8] [font-family:'Geist_Mono',monospace]">
              <Eye size={11} strokeWidth={2.25} className="mr-1 inline-block" aria-hidden="true" />
              + {rows.length - 5} more in the table below
            </li>
          ) : null}
        </ul>
      )}
    </motion.section>
  )
}

export default TeamAttendancePage
