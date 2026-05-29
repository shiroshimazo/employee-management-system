import { Building2, Clock4, TrendingUp, Users } from 'lucide-react'
import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import AdminLayout from '../../../layouts/AdminLayout.jsx'
import StatCard from '../../../components/common/StatCard.jsx'
import EmployeeGrowthChart from '../../../components/charts/EmployeeGrowthChart.jsx'
import DepartmentHeadcountChart from '../../../components/charts/DepartmentHeadcountChart.jsx'
import EmployeeStatusChart from '../../../components/charts/EmployeeStatusChart.jsx'
import AttendanceTrendChart from '../../../components/charts/AttendanceTrendChart.jsx'
import LeaveTypesChart from '../../../components/charts/LeaveTypesChart.jsx'
import RecentEmployeesTable from '../../../components/dashboard/RecentEmployeesTable.jsx'
import PendingLeaveRequestsTable from '../../../components/dashboard/PendingLeaveRequestsTable.jsx'
import AuditLogFeed from '../../../components/dashboard/AuditLogFeed.jsx'
import UpcomingLeaveList from '../../../components/dashboard/UpcomingLeaveList.jsx'
import { getReportData } from '../../../services/report.service.js'
import { useAuth } from '../../../hooks/useAuth.js'

// Static label/icon binding for the KPI row. Values come from
// report.service (real aggregates over the live tables).
const KPI_FIELDS = [
  { key: 'totalEmployees', label: 'Total Employees', icon: Users },
  { key: 'activeDepartments', label: 'Active Departments', icon: Building2 },
  { key: 'pendingLeave', label: 'Pending Leave Requests', icon: Clock4, accent: 'neutral' },
  { key: 'newHires', label: 'New Hires This Month', icon: TrendingUp },
]

function AdminDashboard() {
  const { user } = useAuth()
  const [report, setReport] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    getReportData()
      .then((d) => alive && setReport(d))
      .catch((e) => alive && setError(e?.message ?? 'Failed to load dashboard data.'))
    return () => {
      alive = false
    }
  }, [])

  const greetingName =
    user?.user_metadata?.full_name?.split(' ')[0] ??
    user?.email?.split('@')[0] ??
    'there'

  return (
    <AdminLayout>
      {/* Page header */}
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="m-0 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
            Dashboard
          </p>
          <h1 className="m-0 mt-2 text-[2.25rem] font-bold leading-[1.1] tracking-[-0.01em] text-[#0F1419] max-[600px]:text-[1.75rem]">
            Welcome back, {greetingName}.
          </h1>
          <p className="mb-0 mt-2 text-[0.95rem] leading-snug text-[#4A5568]">
            Here's what's happening across your organization today.
          </p>
        </div>

        <span
          className="inline-flex items-center gap-2 rounded-[10px] bg-white px-3 py-2 text-[0.75rem] font-medium text-[#4A5568] shadow-[0_4px_12px_rgba(15,20,25,0.04)] [font-family:'Geist_Mono',monospace]"
          aria-label="Last updated"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
          Live · updated just now
        </span>
      </header>

      {error ? (
        <p className="mb-6 rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-[0.85rem] text-red-700">
          {error}
        </p>
      ) : null}

      {/* KPI grid — staggers left → right so the row reads as a sweep. */}
      <section aria-label="Key performance indicators">
        <motion.ul
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
          }}
          className="grid list-none grid-cols-4 gap-4 p-0 max-[1100px]:grid-cols-2 max-[600px]:grid-cols-1"
        >
          {KPI_FIELDS.map((field) => (
            <motion.li
              key={field.key}
              variants={{
                hidden: { opacity: 0, y: 12 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
                },
              }}
            >
              <StatCard
                label={field.label}
                icon={field.icon}
                accent={field.accent}
                value={report ? report.kpis[field.key] : '—'}
              />
            </motion.li>
          ))}
        </motion.ul>
      </section>

      {/* Analytics row 1 — long-running trend + categorical breakdown +
          status snapshot. 12-col grid because three pieces want different
          weights: growth (5) + departments (4) + status donut (3). */}
      <section
        className="mt-8 grid grid-cols-12 gap-4 max-[1100px]:grid-cols-1"
        aria-label="Workforce analytics"
      >
        <div className="col-span-5 max-[1100px]:col-span-1">
          <EmployeeGrowthChart data={report?.employeeGrowth ?? []} delay={0.45} />
        </div>
        <div className="col-span-4 max-[1100px]:col-span-1">
          <DepartmentHeadcountChart data={report?.departmentHeadcount ?? []} delay={0.5} />
        </div>
        <div className="col-span-3 max-[1100px]:col-span-1">
          <EmployeeStatusChart data={report?.employeeStatus ?? []} delay={0.55} />
        </div>
      </section>

      {/* Analytics row 2 — attendance and leave types share a row at equal
          weights since both answer "how is time off / time on shaping
          up?" questions. */}
      <section
        className="mt-4 grid grid-cols-2 gap-4 max-[900px]:grid-cols-1"
        aria-label="Time and attendance"
      >
        <AttendanceTrendChart data={report?.attendanceTrend ?? []} delay={0.6} />
        <LeaveTypesChart data={report?.leaveTypes ?? []} delay={0.65} />
      </section>

      {/* Operations row — leave queue is the primary action for the admin
          today, so it gets the wide column. Upcoming events sits beside
          it so the admin can see what's coming once today's queue is
          handled. */}
      <section
        className="mt-4 grid grid-cols-3 gap-4 max-[1100px]:grid-cols-1"
        aria-label="Today's operations"
      >
        <div className="col-span-2 max-[1100px]:col-span-1">
          <PendingLeaveRequestsTable delay={0.7} />
        </div>
        <UpcomingLeaveList delay={0.75} />
      </section>

      {/* People + audit row — recent hires for context, audit feed for
          accountability. */}
      <section
        className="mt-4 grid grid-cols-3 gap-4 max-[1100px]:grid-cols-1"
        aria-label="People and activity"
      >
        <div className="col-span-2 max-[1100px]:col-span-1">
          <RecentEmployeesTable delay={0.8} />
        </div>
        <AuditLogFeed delay={0.85} />
      </section>
    </AdminLayout>
  )
}

export default AdminDashboard
