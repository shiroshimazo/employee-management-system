import { useCallback, useEffect, useRef, useState } from 'react'
import { Building2, Clock4, Download, RefreshCw, TrendingUp, Users } from 'lucide-react'
import AdminLayout from '../../../layouts/AdminLayout.jsx'
import { LoadingButtonLabel } from '../../../components/common/LoadingBars.jsx'
import StatCard from '../../../components/common/StatCard.jsx'
import EmployeeGrowthChart from '../../../components/charts/EmployeeGrowthChart.jsx'
import DepartmentHeadcountChart from '../../../components/charts/DepartmentHeadcountChart.jsx'
import EmployeeStatusChart from '../../../components/charts/EmployeeStatusChart.jsx'
import AttendanceTrendChart from '../../../components/charts/AttendanceTrendChart.jsx'
import LeaveTypesChart from '../../../components/charts/LeaveTypesChart.jsx'
import { getReportData } from '../../../services/report.service.js'

/**
 * AdminReports — analytics overview built on real data (report.service),
 * unlike the home dashboard which still renders mock figures.
 *
 * The five charts accept an optional `data` prop; we own the single fetch
 * here and feed each its slice, so the page makes one batched round-trip
 * instead of five charts each fetching independently.
 *
 * Export: serializes the current aggregates to a CSV the same way the
 * attendance page does — what you see is what you download.
 */

const KPI_FIELDS = [
  { key: 'totalEmployees', label: 'Total Employees', icon: Users },
  { key: 'activeDepartments', label: 'Active Departments', icon: Building2 },
  { key: 'pendingLeave', label: 'Pending Leave Requests', icon: Clock4, accent: 'neutral' },
  { key: 'newHires', label: 'New Hires This Month', icon: TrendingUp },
]

// ── CSV helpers (mirrors AttendanceListPage: quote every cell) ───────────────

function csvCell(value) {
  const s = value == null ? '' : String(value)
  return `"${s.replace(/"/g, '""')}"`
}

// Build a single CSV with one labelled section per aggregate, so HR gets the
// whole report in one file rather than five downloads.
function reportToCSV(report) {
  const lines = []
  const section = (title, header, rows) => {
    lines.push(csvCell(title))
    lines.push(header.map(csvCell).join(','))
    for (const r of rows) lines.push(r.map(csvCell).join(','))
    lines.push('') // blank spacer between sections
  }

  section('KPIs', ['Metric', 'Value'], [
    ['Total Employees', report.kpis.totalEmployees],
    ['Active Departments', report.kpis.activeDepartments],
    ['Pending Leave Requests', report.kpis.pendingLeave],
    ['New Hires This Month', report.kpis.newHires],
  ])
  section('Employee Growth (12mo)', ['Month', 'Total'],
    report.employeeGrowth.map((d) => [d.month, d.total]))
  section('Department Headcount', ['Department', 'Headcount'],
    report.departmentHeadcount.map((d) => [d.department, d.headcount]))
  section('Employee Status', ['Status', 'Count'],
    report.employeeStatus.map((d) => [d.status, d.value]))
  section('Attendance Trend (7d)', ['Day', 'Present', 'Absent'],
    report.attendanceTrend.map((d) => [d.day, d.present, d.absent]))
  section('Leave Types (6mo)', ['Month', 'Sick', 'Vacation', 'Personal', 'Bereavement'],
    report.leaveTypes.map((d) => [d.month, d.sick, d.vacation, d.personal, d.bereavement]))

  return lines.join('\n')
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

function AdminReports() {
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Guard against an older fetch resolving after a newer refresh.
  const reqTokenRef = useRef(0)

  const load = useCallback(async () => {
    const token = ++reqTokenRef.current
    setLoading(true)
    setError(null)
    try {
      const data = await getReportData()
      if (token !== reqTokenRef.current) return
      setReport(data)
    } catch (err) {
      if (token !== reqTokenRef.current) return
      setError(err?.message ?? 'Failed to load reports.')
      setReport(null)
    } finally {
      if (token === reqTokenRef.current) setLoading(false)
    }
  }, [])

  // Defer the initial load out of the synchronous effect body — same pattern
  // the employee/attendance list pages use to keep setState off the render path.
  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  function handleExport() {
    if (!report) return
    const today = new Date().toISOString().slice(0, 10)
    downloadCSV(`reports-${today}.csv`, reportToCSV(report))
  }

  return (
    <AdminLayout>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="m-0 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
            Reports
          </p>
          <h1 className="m-0 mt-2 text-[2rem] font-bold leading-[1.1] tracking-[-0.01em] text-[#0F1419] max-[600px]:text-[1.6rem]">
            Analytics &amp; reports
          </h1>
          <p className="mb-0 mt-2 text-[0.95rem] leading-snug text-[#4A5568]">
            Live workforce, attendance, and leave metrics across the organization.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex h-9 items-center gap-1.5 rounded-[8px] border border-slate-200 bg-white px-3 text-[0.8rem] font-medium text-[#4A5568] transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <LoadingButtonLabel label="Refreshing" />
            ) : (
              <>
                <RefreshCw size={14} strokeWidth={2.25} aria-hidden="true" />
                Refresh
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={!report || loading}
            className="inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-[#2C5EF5] px-3 text-[0.8rem] font-semibold text-white transition-colors hover:bg-[#1F4CE0] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download size={14} strokeWidth={2.25} aria-hidden="true" />
            Export CSV
          </button>
        </div>
      </header>

      {error ? (
        <p className="mb-4 rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-[0.85rem] text-red-700">
          {error}
        </p>
      ) : null}

      {/* KPI row */}
      <section className="grid grid-cols-4 gap-4 max-[1100px]:grid-cols-2 max-[560px]:grid-cols-1" aria-label="Key metrics">
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

      {/* Charts grid. The charts are controlled — we pass real data slices.
          While loading we pass [] so each renders its own empty state rather
          than its mock self-fetch. */}
      <section className="mt-6 grid grid-cols-2 gap-4 max-[900px]:grid-cols-1" aria-label="Charts">
        <div className="col-span-2 max-[900px]:col-span-1">
          <EmployeeGrowthChart data={report?.employeeGrowth ?? []} />
        </div>
        <DepartmentHeadcountChart data={report?.departmentHeadcount ?? []} delay={0.05} />
        <EmployeeStatusChart data={report?.employeeStatus ?? []} delay={0.1} />
        <AttendanceTrendChart data={report?.attendanceTrend ?? []} delay={0.15} />
        <LeaveTypesChart data={report?.leaveTypes ?? []} delay={0.2} />
      </section>
    </AdminLayout>
  )
}

export default AdminReports
