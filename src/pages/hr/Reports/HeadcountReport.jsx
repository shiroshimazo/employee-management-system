import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Download } from 'lucide-react'
import AdminLayout from '../../../layouts/AdminLayout.jsx'
import DepartmentHeadcountChart from '../../../components/charts/DepartmentHeadcountChart.jsx'
import EmployeeStatusChart from '../../../components/charts/EmployeeStatusChart.jsx'
import EmployeeGrowthChart from '../../../components/charts/EmployeeGrowthChart.jsx'
import { getReportData } from '../../../services/report.service.js'

/**
 * HeadcountReport — workforce headcount by department, status mix, and 12-month
 * growth, with CSV export. Reuses report.service (real data, no new schema).
 */

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

function HeadcountReport() {
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setReport(await getReportData())
    } catch (err) {
      setError(err?.message ?? 'Failed to load headcount data.')
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
    section('Headcount by department', ['Department', 'Headcount'],
      report.departmentHeadcount.map((d) => [d.department, d.headcount]))
    section('Status mix', ['Status', 'Count'],
      report.employeeStatus.map((d) => [d.status, d.value]))
    section('Growth (12 mo)', ['Month', 'Total'],
      report.employeeGrowth.map((d) => [d.month, d.total]))
    downloadCSV(`headcount-${new Date().toISOString().slice(0, 10)}.csv`, lines.join('\n'))
  }

  return (
    <AdminLayout>
      <div className="mb-4">
        <a
          href="/hr/reports"
          className="inline-flex items-center gap-1.5 text-[0.8rem] font-medium text-[#2C5EF5] hover:text-[#1E47C9]"
        >
          <ArrowLeft size={14} strokeWidth={2.25} aria-hidden="true" />
          Back to reports
        </a>
      </div>

      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="m-0 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
            Reports
          </p>
          <h1 className="m-0 mt-2 text-[2rem] font-bold leading-[1.1] tracking-[-0.01em] text-[#0F1419] max-[600px]:text-[1.6rem]">
            Headcount
          </h1>
          <p className="mb-0 mt-2 text-[0.95rem] leading-snug text-[#4A5568]">
            Workforce distribution by department and status, and growth over time.
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

      <section className="grid grid-cols-2 gap-4 max-[900px]:grid-cols-1" aria-label="Headcount charts">
        <DepartmentHeadcountChart data={report?.departmentHeadcount ?? []} />
        <EmployeeStatusChart data={report?.employeeStatus ?? []} delay={0.05} />
        <div className="col-span-2 max-[900px]:col-span-1">
          <EmployeeGrowthChart data={report?.employeeGrowth ?? []} delay={0.1} />
        </div>
      </section>
    </AdminLayout>
  )
}

export default HeadcountReport
