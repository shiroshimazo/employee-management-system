import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { CalendarDays, Download, Pencil, Trash2 } from 'lucide-react'
import AdminLayout from '../../../layouts/AdminLayout.jsx'
import StatusBadge from '../../../components/common/StatusBadge.jsx'
import AttendanceToolbar from '../../../components/attendance/AttendanceToolbar.jsx'
import AttendanceSummaryCards from '../../../components/attendance/AttendanceSummaryCards.jsx'
import AttendanceEditModal from '../../../components/attendance/AttendanceEditModal.jsx'
import DeleteAttendanceModal from '../../../components/attendance/DeleteAttendanceModal.jsx'
import {
  deleteAttendance,
  getAttendanceRecords,
  getTodayAttendanceSummary,
  updateAttendance,
} from '../../../services/attendance.service.js'
import { getDepartments } from '../../../services/department.service.js'

/**
 * AttendanceListPage — admin / HR attendance management.
 *
 * Mirrors LeaveListPage / EmployeeListPage:
 *   - debounced search via the same race-guarded request-token pattern
 *   - filters refetch through the right service path
 *   - summary cards refresh in parallel with the list
 *   - edit / delete modals own their own busy state; success replaces the
 *     row in place rather than refetching the whole page
 *
 * Search note: the leave / employee services run a server-side search via
 * .or(...). Attendance has no obvious "free text" column — the only thing
 * that matters is the joined employee name. So we filter the joined name
 * client-side after fetching, which is fine at attendance volumes.
 *
 * Export: an "Export CSV" button serializes the current visible rows to
 * CSV. We deliberately export *what the user is looking at*, filters and
 * all, rather than a separate download endpoint — that matches what HR
 * usually wants when they hit Export.
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

// CSV helpers. We quote every cell to dodge commas/newlines in remarks.
function csvCell(value) {
  const s = value == null ? '' : String(value)
  return `"${s.replace(/"/g, '""')}"`
}

function rowsToCSV(rows) {
  const header = [
    'Employee',
    'Employee #',
    'Department',
    'Date',
    'Clock In',
    'Clock Out',
    'Total Hours',
    'Status',
    'Remarks',
  ]
  const body = rows.map((r) =>
    [
      r.employee?.profile?.full_name ?? '',
      r.employee?.employee_number ?? '',
      r.employee?.department?.name ?? '',
      r.date ?? '',
      r.check_in ?? '',
      r.check_out ?? '',
      r.total_hours ?? '',
      r.status ?? '',
      r.notes ?? '',
    ].map(csvCell).join(','),
  )
  return [header.map(csvCell).join(','), ...body].join('\n')
}

function downloadCSV(filename, csv) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function AttendanceListPage() {
  const [rows, setRows] = useState([])
  const [count, setCount] = useState(0)
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

  // Modal state
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

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
      // Free-text search → client-side over the joined employee name.
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
      setError(err?.message ?? 'Failed to load attendance.')
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

  // Summary + departments load once on mount. Summary is "today" — it
  // doesn't shift with the filter bar, which scopes the *list*.
  useEffect(() => {
    let alive = true
    Promise.all([getTodayAttendanceSummary().catch(() => null), getDepartments()])
      .then(([s, d]) => {
        if (!alive) return
        setSummary(s)
        setDepartments(d?.data ?? [])
      })
      .catch(() => {
        if (alive) setDepartments([])
      })
    return () => {
      alive = false
    }
  }, [])

  const visibleCount = rows.length
  const totalLabel = useMemo(() => {
    if (loading) return 'Loading…'
    if (count === visibleCount) {
      return `${count} ${count === 1 ? 'record' : 'records'}`
    }
    return `${visibleCount} of ${count} records`
  }, [loading, count, visibleCount])

  async function handleEdit(patch) {
    if (!editTarget) return
    const updated = await updateAttendance(editTarget.id, patch)
    setRows((prev) => prev.map((r) => (r.id === editTarget.id ? updated : r)))
  }

  async function handleDelete(record) {
    await deleteAttendance(record.id)
    setRows((prev) => prev.filter((r) => r.id !== record.id))
    setCount((c) => Math.max(0, c - 1))
  }

  function handleExport() {
    if (rows.length === 0) return
    const today = new Date().toISOString().slice(0, 10)
    downloadCSV(`attendance-${today}.csv`, rowsToCSV(rows))
  }

  return (
    <AdminLayout>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="m-0 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
            Attendance
          </p>
          <h1 className="m-0 mt-2 text-[2rem] font-bold leading-[1.1] tracking-[-0.01em] text-[#0F1419] max-[600px]:text-[1.6rem]">
            Attendance management
          </h1>
          <p className="mb-0 mt-2 text-[0.95rem] leading-snug text-[#4A5568]">
            Review punches, fix mistakes, and audit attendance across the organization.
          </p>
        </div>
        <span
          className="inline-flex items-center gap-2 rounded-[10px] bg-white px-3 py-2 text-[0.75rem] font-medium text-[#4A5568] shadow-[0_4px_12px_rgba(15,20,25,0.04)] [font-family:'Geist_Mono',monospace]"
          aria-label="Total attendance records"
        >
          <CalendarDays size={12} strokeWidth={2.25} aria-hidden="true" />
          {totalLabel}
        </span>
      </header>

      <div className="mb-4">
        <AttendanceSummaryCards summary={summary} loading={!summary} />
      </div>

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
        trailing={
          <button
            type="button"
            onClick={handleExport}
            disabled={rows.length === 0}
            className="inline-flex h-9 items-center gap-1.5 rounded-[8px] border border-slate-200 bg-white px-3 text-[0.8rem] font-medium text-[#4A5568] transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download size={14} strokeWidth={2.25} aria-hidden="true" />
            Export CSV
          </button>
        }
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
        aria-label="Attendance"
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
                  '',
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
                  <td colSpan={8} className="px-4 py-10 text-center text-[0.85rem] text-[#4A5568]">
                    Loading attendance…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center">
                    <p className="m-0 text-[0.95rem] font-semibold text-[#0F1419]">
                      No attendance records match.
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
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setEditTarget(r)}
                            aria-label={`Edit ${name}'s attendance`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-[#4A5568] transition-colors hover:bg-slate-100 hover:text-[#0F1419]"
                          >
                            <Pencil size={14} strokeWidth={2} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(r)}
                            aria-label={`Delete ${name}'s attendance`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-[#4A5568] transition-colors hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 size={14} strokeWidth={2} />
                          </button>
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

      <AttendanceEditModal
        open={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        record={editTarget}
        onSubmit={handleEdit}
      />

      <DeleteAttendanceModal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        record={deleteTarget}
        onConfirm={handleDelete}
      />
    </AdminLayout>
  )
}

export default AttendanceListPage
