import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, FileText } from 'lucide-react'
import AdminLayout from '../../../layouts/AdminLayout.jsx'
import StatusBadge from '../../../components/common/StatusBadge.jsx'
import { getEmployeeById } from '../../../services/employee.service.js'
import { getAttendanceStats } from '../../../services/attendance.service.js'
import { getLeaveRequestsByEmployee } from '../../../services/leave.service.js'
import { getDocumentsByEmployee } from '../../../services/document.service.js'

/**
 * EmployeeDetail — the 360 view of one employee, reached from the directory
 * at /hr/employee/<id>. Nothing else in the app shows a single employee's
 * full record, so this is the genuinely-new surface of the HR module.
 *
 * Pulls three things in parallel (all RLS-scoped to what HR may see):
 *   - the joined employee row (profile + department + manager)
 *   - this month's attendance tally
 *   - the few most recent leave requests
 */

// The id is the last path segment of /hr/employee/<id>.
function employeeIdFromPath() {
  const parts = window.location.pathname.split('/').filter(Boolean)
  return parts[parts.length - 1] ?? null
}

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

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatRange(from, to) {
  if (!from) return '—'
  const f = new Date(from)
  const t = new Date(to ?? from)
  const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return f.toDateString() === t.toDateString() ? fmt(f) : `${fmt(f)} – ${fmt(t)}`
}

const ATTENDANCE_TILES = [
  { key: 'present', label: 'Present' },
  { key: 'late', label: 'Late' },
  { key: 'half_day', label: 'Half-day' },
  { key: 'leave', label: 'Leave' },
  { key: 'absent', label: 'Absent' },
]

function EmployeeDetail() {
  const [employee, setEmployee] = useState(null)
  const [stats, setStats] = useState(null)
  const [leave, setLeave] = useState([])
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notFound, setNotFound] = useState(false)

  const load = useCallback(async () => {
    const id = employeeIdFromPath()
    setLoading(true)
    setError(null)
    try {
      const emp = await getEmployeeById(id)
      if (!emp) {
        setNotFound(true)
        return
      }
      setEmployee(emp)
      // Attendance stats + recent leave + documents are scoped to this
      // employee; fetch in parallel since none depends on the others. Each
      // catch falls back to empty so a missing 014 migration (documents) or a
      // transient error doesn't blank the whole page.
      const [statsRes, leaveRes, docsRes] = await Promise.all([
        getAttendanceStats({ employeeId: id }).catch(() => null),
        getLeaveRequestsByEmployee(id, { limit: 5 }).catch(() => ({ data: [] })),
        getDocumentsByEmployee(id).catch(() => []),
      ])
      setStats(statsRes)
      setLeave(leaveRes?.data ?? [])
      setDocs(docsRes ?? [])
    } catch (err) {
      setError(err?.message ?? 'Failed to load this employee.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Defer the load out of the synchronous effect body — same pattern the
  // other admin pages use to keep setState off the render path.
  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  const backLink = (
    <a
      href="/hr/directory"
      className="inline-flex items-center gap-1.5 text-[0.8rem] font-medium text-[#2C5EF5] hover:text-[#1E47C9]"
    >
      <ArrowLeft size={14} strokeWidth={2.25} aria-hidden="true" />
      Back to directory
    </a>
  )

  if (notFound) {
    return (
      <AdminLayout>
        <div className="mb-4">{backLink}</div>
        <div className="rounded-[16px] border border-slate-200 bg-white p-10 text-center shadow-[0_8px_24px_rgba(15,20,25,0.04)]">
          <p className="m-0 text-[0.95rem] font-semibold text-[#0F1419]">Employee not found.</p>
          <p className="m-0 mt-1 text-[0.85rem] text-[#4A5568]">
            This record may have been removed, or the link is incorrect.
          </p>
        </div>
      </AdminLayout>
    )
  }

  const name = employee?.profile?.full_name ?? 'Unnamed'
  const managerName = employee?.manager?.profile?.full_name

  return (
    <AdminLayout>
      <div className="mb-4">{backLink}</div>

      {error ? (
        <p className="mb-4 rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-[0.85rem] text-red-700">
          {error}
        </p>
      ) : null}

      {loading && !employee ? (
        <p className="text-[0.9rem] text-[#4A5568]">Loading employee…</p>
      ) : employee ? (
        <>
          {/* Identity header */}
          <header className="mb-6 flex items-center gap-4">
            <span
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#2C5EF5]/10 text-[1.1rem] font-semibold text-[#2C5EF5] [font-family:'Geist_Mono',monospace]"
              aria-hidden="true"
            >
              {initials(name)}
            </span>
            <div className="min-w-0">
              <h1 className="m-0 text-[1.75rem] font-bold leading-[1.1] tracking-[-0.01em] text-[#0F1419]">
                {name}
              </h1>
              <p className="m-0 mt-1 flex items-center gap-2 text-[0.85rem] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
                {employee.employee_number}
                {employee.status ? <StatusBadge value={employee.status} /> : null}
              </p>
            </div>
          </header>

          <section className="grid grid-cols-3 gap-4 max-[900px]:grid-cols-1">
            {/* Employment details */}
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="col-span-2 rounded-[16px] border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,20,25,0.04)] max-[900px]:col-span-1"
              aria-label="Employment details"
            >
              <p className="m-0 mb-4 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
                Employment
              </p>
              <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
                <Detail label="Department">{employee.department?.name ?? '—'}</Detail>
                <Detail label="Position">{employee.position ?? '—'}</Detail>
                <Detail label="Employment type">
                  {employee.employment_type ? <StatusBadge value={employee.employment_type} /> : '—'}
                </Detail>
                <Detail label="Manager">{managerName ?? '—'}</Detail>
                <Detail label="Hire date">{formatDate(employee.hire_date)}</Detail>
                <Detail label="Phone">{employee.profile?.phone ?? '—'}</Detail>
              </div>
            </motion.section>

            {/* This month's attendance */}
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col gap-3 rounded-[16px] border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,20,25,0.04)]"
              aria-label="This month's attendance"
            >
              <p className="m-0 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
                Attendance · this month
              </p>
              <div className="grid grid-cols-2 gap-2">
                {ATTENDANCE_TILES.map((t) => (
                  <div key={t.key} className="rounded-[10px] bg-slate-50 px-3 py-2">
                    <p className="m-0 text-[1.1rem] font-bold leading-none text-[#0F1419]">
                      {stats ? (stats[t.key] ?? 0) : '—'}
                    </p>
                    <p className="m-0 mt-1 text-[0.7rem] text-[#4A5568]">{t.label}</p>
                  </div>
                ))}
                <div className="rounded-[10px] bg-[#2C5EF5]/[0.06] px-3 py-2">
                  <p className="m-0 text-[1.1rem] font-bold leading-none text-[#2C5EF5]">
                    {stats ? `${stats.total_hours ?? 0}h` : '—'}
                  </p>
                  <p className="m-0 mt-1 text-[0.7rem] text-[#4A5568]">Hours</p>
                </div>
              </div>
            </motion.section>
          </section>

          {/* Recent leave */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="mt-4 rounded-[16px] border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,20,25,0.04)]"
            aria-label="Recent leave"
          >
            <p className="m-0 mb-3 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
              Recent leave
            </p>
            {leave.length === 0 ? (
              <p className="m-0 text-[0.85rem] text-[#4A5568]">No leave requests on record.</p>
            ) : (
              <ul className="m-0 flex flex-col gap-2 p-0">
                {leave.map((lv) => (
                  <li
                    key={lv.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-slate-200 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <StatusBadge value={lv.leave_type} />
                      <span className="text-[0.8rem] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
                        {formatRange(lv.start_date, lv.end_date)} · {lv.days}{' '}
                        {lv.days === 1 ? 'day' : 'days'}
                      </span>
                    </div>
                    <StatusBadge value={lv.status} />
                  </li>
                ))}
              </ul>
            )}
          </motion.section>

          {/* Documents */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="mt-4 rounded-[16px] border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,20,25,0.04)]"
            aria-label="Documents"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="m-0 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
                Documents
              </p>
              <a
                href="/hr/documents"
                className="text-[0.75rem] font-medium text-[#2C5EF5] hover:text-[#1E47C9]"
              >
                Manage
              </a>
            </div>
            {docs.length === 0 ? (
              <p className="m-0 text-[0.85rem] text-[#4A5568]">No documents on record.</p>
            ) : (
              <ul className="m-0 flex flex-col gap-2 p-0">
                {docs.map((d) => (
                  <li
                    key={d.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-slate-200 px-3 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <FileText size={15} strokeWidth={2} className="shrink-0 text-[#94A3B8]" aria-hidden="true" />
                      {d.file_url ? (
                        <a
                          href={d.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="truncate text-[0.85rem] font-medium text-[#2C5EF5] hover:underline"
                        >
                          {d.title}
                        </a>
                      ) : (
                        <span className="truncate text-[0.85rem] font-medium text-[#0F1419]">
                          {d.title}
                        </span>
                      )}
                      <StatusBadge value={d.doc_type} />
                    </div>
                    <span className="shrink-0 text-[0.75rem] text-[#94A3B8] [font-family:'Geist_Mono',monospace]">
                      {formatDate(d.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </motion.section>
        </>
      ) : null}
    </AdminLayout>
  )
}

function Detail({ label, children }) {
  return (
    <div>
      <p className="m-0 text-[0.65rem] font-medium uppercase tracking-[0.1em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
        {label}
      </p>
      <p className="m-0 mt-1 text-[0.9rem] text-[#0F1419]">{children}</p>
    </div>
  )
}

export default EmployeeDetail
