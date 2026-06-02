import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  CalendarCheck,
  CalendarDays,
  Clock4,
  FileText,
  UserCircle,
} from 'lucide-react'
import AdminLayout from '../../../layouts/AdminLayout.jsx'
import { LoadingState } from '../../../components/common/LoadingBars.jsx'
import StatusBadge from '../../../components/common/StatusBadge.jsx'
import { useAuth } from '../../../hooks/useAuth.js'
import { supabase } from '../../../lib/supabase.js'
import { getAttendanceStats, getTodayAttendance } from '../../../services/attendance.service.js'
import { getLeaveRequestsByEmployee } from '../../../services/leave.service.js'

/**
 * MyDashboardPage — employee home.
 *
 * Pulls together the most relevant slices from each self-service surface:
 *   - "today" punch state (drives the at-a-glance status pill)
 *   - this month's attendance tally + total hours logged
 *   - last few leave requests
 *   - quick links to the deeper pages
 *
 * Reads only — every mutation goes through the dedicated page so this view
 * never has to re-implement the same form twice. RLS scopes everything to
 * the caller's own data.
 */

function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function MyDashboardPage() {
  const { user, profile } = useAuth()
  const [employeeId, setEmployeeId] = useState(null)
  const [today, setToday] = useState(null)
  const [stats, setStats] = useState(null)
  const [leave, setLeave] = useState([])
  const [loading, setLoading] = useState(true)

  // Resolve current user's employees.id once. Same lookup pattern as the
  // other /employee pages — promote to a shared hook when a third consumer
  // shows up.
  useEffect(() => {
    if (!user?.id) return
    let alive = true
    supabase
      .from('employees')
      .select('id')
      .eq('profile_id', user.id)
      .maybeSingle()
      .then(({ data }) => alive && setEmployeeId(data?.id ?? null))
    return () => {
      alive = false
    }
  }, [user?.id])

  useEffect(() => {
    if (!employeeId) return
    let alive = true
    Promise.all([
      getTodayAttendance(employeeId).catch(() => null),
      getAttendanceStats({ employeeId }).catch(() => null),
      getLeaveRequestsByEmployee(employeeId, { limit: 5 }).catch(() => ({ data: [] })),
    ]).then(([todayRow, monthly, lr]) => {
      if (!alive) return
      setToday(todayRow)
      setStats(monthly)
      setLeave(lr.data ?? [])
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [employeeId])

  const greeting = useMemo(() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 18) return 'Good afternoon'
    return 'Good evening'
  }, [])

  const firstName =
    profile?.full_name?.split(' ')[0] ??
    user?.user_metadata?.full_name?.split(' ')[0] ??
    user?.email?.split('@')[0] ??
    'there'

  return (
    <AdminLayout>
      <header className="mb-6">
        <p className="m-0 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
          Personal
        </p>
        <h1 className="m-0 mt-2 text-[2rem] font-bold leading-[1.1] tracking-[-0.01em] text-[#0F1419] max-[600px]:text-[1.6rem]">
          {greeting}, {firstName}.
        </h1>
        <p className="mb-0 mt-2 text-[0.95rem] leading-snug text-[#4A5568]">
          Here's a quick look at your day, your hours, and your time off.
        </p>
      </header>

      {/* Top row: today status + month totals */}
      <section className="grid grid-cols-3 gap-4 max-[900px]:grid-cols-1">
        <Card title="Today" icon={Clock4}>
          <div className="flex items-center justify-between">
            <p className="m-0 text-[1.5rem] font-bold text-[#0F1419] [font-family:'Geist',sans-serif]">
              {today?.check_in
                ? new Date(today.check_in).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                  })
                : '—'}
            </p>
            {today?.status ? <StatusBadge value={today.status} /> : null}
          </div>
          <p className="mt-1 text-[0.8rem] text-[#4A5568]">
            {today?.check_in ? 'Clocked in' : "You haven't clocked in yet."}
          </p>
        </Card>

        <Card title="This month" icon={CalendarDays}>
          <p className="m-0 text-[1.5rem] font-bold text-[#0F1419] [font-family:'Geist',sans-serif]">
            {stats?.total_hours ?? 0}h
          </p>
          <p className="mt-1 text-[0.8rem] text-[#4A5568]">
            {stats?.present ?? 0} present · {stats?.late ?? 0} late · {stats?.absent ?? 0} absent
          </p>
        </Card>

        <Card title="Open leave" icon={CalendarCheck}>
          <p className="m-0 text-[1.5rem] font-bold text-[#0F1419] [font-family:'Geist',sans-serif]">
            {leave.filter((l) => l.status === 'pending').length}
          </p>
          <p className="mt-1 text-[0.8rem] text-[#4A5568]">
            pending request{leave.filter((l) => l.status === 'pending').length === 1 ? '' : 's'}
          </p>
        </Card>
      </section>

      {/* Bottom row: recent leave + quick links */}
      <section className="mt-4 grid grid-cols-3 gap-4 max-[900px]:grid-cols-1">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="col-span-2 flex flex-col gap-3 rounded-[16px] border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,20,25,0.04)] max-[900px]:col-span-1"
          aria-label="Recent leave requests"
        >
          <header className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="m-0 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
                Recent leave
              </p>
              <p className="m-0 mt-1 text-[0.85rem] text-[#4A5568]">
                Your last few requests
              </p>
            </div>
            <a
              href="/employee/leave"
              className="text-[0.78rem] font-medium text-[#2C5EF5] hover:text-[#1E47C9]"
            >
              View all
            </a>
          </header>

          {loading ? (
            <LoadingState
              label="Loading recent leave"
              className="text-[0.85rem] text-[#94A3B8]"
              barsClassName="h-3.5 w-5"
            />
          ) : leave.length === 0 ? (
            <p className="m-0 rounded-[10px] border border-dashed border-slate-200 bg-slate-50/40 px-3 py-4 text-center text-[0.85rem] text-[#94A3B8]">
              No leave requests yet.
            </p>
          ) : (
            <ul className="m-0 flex flex-col gap-2 p-0">
              {leave.slice(0, 5).map((r) => (
                <li
                  key={r.id}
                  className="flex items-center gap-3 rounded-[10px] border border-slate-200 bg-white p-2"
                >
                  <StatusBadge value={r.leave_type} />
                  <div className="min-w-0 flex-1">
                    <p className="m-0 truncate text-[0.85rem] text-[#0F1419] [font-family:'Geist_Mono',monospace]">
                      {fmtDate(r.start_date)} → {fmtDate(r.end_date)}
                    </p>
                    <p className="m-0 truncate text-[0.75rem] text-[#94A3B8]">
                      {r.days ?? '—'} day{r.days === 1 ? '' : 's'} · {r.reason}
                    </p>
                  </div>
                  <StatusBadge value={r.status} />
                </li>
              ))}
            </ul>
          )}
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col gap-3 rounded-[16px] border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,20,25,0.04)]"
          aria-label="Quick links"
        >
          <p className="m-0 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
            Jump to
          </p>
          <QuickLink href="/employee/attendance" icon={CalendarDays}>
            My attendance
          </QuickLink>
          <QuickLink href="/employee/leave" icon={CalendarCheck}>
            My leave
          </QuickLink>
          <QuickLink href="/employee/payslips" icon={FileText}>
            My payslips
          </QuickLink>
          <QuickLink href="/employee/profile" icon={UserCircle}>
            My profile
          </QuickLink>
        </motion.section>
      </section>
    </AdminLayout>
  )
}

function Card({ title, icon: Icon, children }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col gap-2 rounded-[16px] border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,20,25,0.04)]"
    >
      <header className="flex items-center justify-between">
        <p className="m-0 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
          {title}
        </p>
        <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-slate-100 text-[#4A5568]" aria-hidden="true">
          <Icon size={14} strokeWidth={2.25} />
        </span>
      </header>
      {children}
    </motion.section>
  )
}

function QuickLink({ href, icon: Icon, children }) {
  return (
    <a
      href={href}
      className="flex items-center gap-3 rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-[0.85rem] text-[#0F1419] transition-colors hover:bg-slate-50 hover:text-[#2C5EF5]"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[#2C5EF5]/10 text-[#2C5EF5]" aria-hidden="true">
        <Icon size={14} strokeWidth={2.25} />
      </span>
      <span className="font-medium">{children}</span>
    </a>
  )
}

export default MyDashboardPage
