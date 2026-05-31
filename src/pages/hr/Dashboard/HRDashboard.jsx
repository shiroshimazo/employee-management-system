import { useCallback, useEffect, useState } from 'react'
import { Building2, Clock4, TrendingUp, Users } from 'lucide-react'
import AdminLayout from '../../../layouts/AdminLayout.jsx'
import StatCard from '../../../components/common/StatCard.jsx'
import DepartmentHeadcountChart from '../../../components/charts/DepartmentHeadcountChart.jsx'
import EmployeeStatusChart from '../../../components/charts/EmployeeStatusChart.jsx'
import { getReportData } from '../../../services/report.service.js'
import { useAuth } from '../../../hooks/useAuth.js'

/**
 * HRDashboard — people-ops landing page for HR (and admin, who can also reach
 * /hr). Built on real data via report.service (RLS lets HR read the org).
 *
 * Intentionally leaner than the admin home: HR cares about the headcount
 * picture and the directory, not the full ops feed. We reuse the existing KPI
 * tiles and two workforce charts rather than duplicating the whole dashboard.
 */

const KPI_FIELDS = [
  { key: 'totalEmployees', label: 'Total Employees', icon: Users },
  { key: 'activeDepartments', label: 'Active Departments', icon: Building2 },
  { key: 'pendingLeave', label: 'Pending Leave Requests', icon: Clock4, accent: 'neutral' },
  { key: 'newHires', label: 'New Hires This Month', icon: TrendingUp },
]

function HRDashboard() {
  const { user } = useAuth()
  const [report, setReport] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getReportData()
      setReport(data)
    } catch (err) {
      setError(err?.message ?? 'Failed to load HR data.')
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

  const greetingName =
    user?.user_metadata?.full_name?.split(' ')[0] ??
    user?.email?.split('@')[0] ??
    'there'

  return (
    <AdminLayout>
      <header className="mb-6">
        <p className="m-0 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
          People
        </p>
        <h1 className="m-0 mt-2 text-[2rem] font-bold leading-[1.1] tracking-[-0.01em] text-[#0F1419] max-[600px]:text-[1.6rem]">
          Welcome back, {greetingName}.
        </h1>
        <p className="mb-0 mt-2 text-[0.95rem] leading-snug text-[#4A5568]">
          The workforce at a glance. Open the directory to dig into a record.
        </p>
      </header>

      {error ? (
        <p className="mb-6 rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-[0.85rem] text-red-700">
          {error}
        </p>
      ) : null}

      {/* KPI row */}
      <section
        className="grid grid-cols-4 gap-4 max-[1100px]:grid-cols-2 max-[560px]:grid-cols-1"
        aria-label="People metrics"
      >
        {KPI_FIELDS.map((f) => (
          <StatCard
            key={f.key}
            label={f.label}
            value={loading || !report ? '—' : report.kpis[f.key]}
            icon={f.icon}
            accent={f.accent}
          />
        ))}
      </section>

      {/* Workforce charts — headcount split + status mix */}
      <section
        className="mt-6 grid grid-cols-2 gap-4 max-[900px]:grid-cols-1"
        aria-label="Workforce"
      >
        <DepartmentHeadcountChart data={report?.departmentHeadcount ?? []} />
        <EmployeeStatusChart data={report?.employeeStatus ?? []} delay={0.05} />
      </section>
    </AdminLayout>
  )
}

export default HRDashboard
