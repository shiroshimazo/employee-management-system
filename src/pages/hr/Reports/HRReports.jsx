import { useCallback, useEffect, useState } from 'react'
import {
  ArrowUpRight,
  Building2,
  Clock4,
  Download,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react'
import AdminLayout from '../../../layouts/AdminLayout.jsx'
import StatCard from '../../../components/common/StatCard.jsx'
import DepartmentHeadcountChart from '../../../components/charts/DepartmentHeadcountChart.jsx'
import EmployeeStatusChart from '../../../components/charts/EmployeeStatusChart.jsx'
import { getReportData } from '../../../services/report.service.js'

/**
 * HRReports — the Reports hub: a KPI overview + workforce snapshot, with links
 * into the deeper Headcount and Turnover reports. Real data via report.service
 * (RLS lets HR read the org). CSV export covers the snapshot figures.
 */

const KPI_FIELDS = [
  { key: 'totalEmployees', label: 'Total Employees', icon: Users },
  { key: 'activeDepartments', label: 'Active Departments', icon: Building2 },
  { key: 'pendingLeave', label: 'Pending Leave Requests', icon: Clock4, accent: 'neutral' },
  { key: 'newHires', label: 'New Hires This Month', icon: TrendingUp },
]

const DEEP_DIVES = [
  {
    href: '/hr/reports/headcount',
    title: 'Headcount',
    blurb: 'Department distribution, status mix, and 12-month growth.',
    icon: Users,
  },
  {
    href: '/hr/reports/turnover',
    title: 'Turnover',
    blurb: 'Hires, exits, and turnover rate over the last 12 months.',
    icon: TrendingDown,
  },
]

function csvCell(value) {
  const s = value == null ? '' : String(value)
  return `"${s.replace(/"/g, '""')}"`
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

function HRReports() {
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setReport(await getReportData())
    } catch (err) {
      setError(err?.message ?? 'Failed to load reports.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  function handleExport() {
    if (!report) return
    const lines = []
    const section = (title, header, rows) => {
      lines.push(csvCell(title))
      lines.push(header.map(csvCell).join(','))
      for (const r of rows) lines.push(r.map(csvCell).join(','))
      lines.push('')
    }
    section('KPIs', ['Metric', 'Value'], [
      ['Total Employees', report.kpis.totalEmployees],
      ['Active Departments', report.kpis.activeDepartments],
      ['Pending Leave Requests', report.kpis.pendingLeave],
      ['New Hires This Month', report.kpis.newHires],
    ])
    section('Headcount by department', ['Department', 'Headcount'],
      report.departmentHeadcount.map((d) => [d.department, d.headcount]))
    section('Status mix', ['Status', 'Count'],
      report.employeeStatus.map((d) => [d.status, d.value]))
    downloadCSV(`hr-report-${new Date().toISOString().slice(0, 10)}.csv`, lines.join('\n'))
  }

  return (
    <AdminLayout>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="m-0 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
            Reports
          </p>
          <h1 className="m-0 mt-2 text-[2rem] font-bold leading-[1.1] tracking-[-0.01em] text-[#0F1419] max-[600px]:text-[1.6rem]">
            HR reports
          </h1>
          <p className="mb-0 mt-2 text-[0.95rem] leading-snug text-[#4A5568]">
            Workforce metrics at a glance. Open a report for the detail.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={!report || loading}
          className="inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-[#2C5EF5] px-3 text-[0.8rem] font-semibold text-white transition-colors hover:bg-[#1E47C9] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Download size={14} strokeWidth={2.25} aria-hidden="true" />
          Export CSV
        </button>
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

      {/* Deep-dive links */}
      <section className="mt-4 grid grid-cols-2 gap-4 max-[560px]:grid-cols-1" aria-label="Detailed reports">
        {DEEP_DIVES.map((d) => {
          const Icon = d.icon
          return (
            <a
              key={d.href}
              href={d.href}
              className="group flex items-start gap-3 rounded-[16px] border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,20,25,0.04)] transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(15,20,25,0.08)]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#2C5EF5]/10 text-[#2C5EF5]" aria-hidden="true">
                <Icon size={18} strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="m-0 flex items-center gap-1 text-[0.95rem] font-semibold text-[#0F1419]">
                  {d.title}
                  <ArrowUpRight size={14} strokeWidth={2.25} className="text-[#94A3B8] transition-colors group-hover:text-[#2C5EF5]" aria-hidden="true" />
                </p>
                <p className="m-0 mt-1 text-[0.85rem] text-[#4A5568]">{d.blurb}</p>
              </div>
            </a>
          )
        })}
      </section>

      {/* Snapshot charts */}
      <section className="mt-4 grid grid-cols-2 gap-4 max-[900px]:grid-cols-1" aria-label="Workforce snapshot">
        <DepartmentHeadcountChart data={report?.departmentHeadcount ?? []} />
        <EmployeeStatusChart data={report?.employeeStatus ?? []} delay={0.05} />
      </section>
    </AdminLayout>
  )
}

export default HRReports
