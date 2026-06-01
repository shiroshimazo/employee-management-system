import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Download, TrendingDown, UserMinus, UserPlus, Users } from 'lucide-react'
import AdminLayout from '../../../layouts/AdminLayout.jsx'
import StatCard from '../../../components/common/StatCard.jsx'
import EmployeeGrowthChart from '../../../components/charts/EmployeeGrowthChart.jsx'
import { getTurnoverData } from '../../../services/report.service.js'

/**
 * TurnoverReport — hires vs exits and turnover rate over the last 12 months,
 * computed from the employees table (hire_date / termination_date). Nothing
 * else in the app surfaces attrition, so this is the genuinely-new report.
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

function TurnoverReport() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await getTurnoverData())
    } catch (err) {
      setError(err?.message ?? 'Failed to load turnover data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  function handleExport() {
    if (!data) return
    const header = ['Month', 'Hires', 'Exits', 'Headcount']
    const body = data.months.map((m) => [m.month, m.hires, m.exits, m.headcount])
    const csv = [header, ...body].map((r) => r.map(csvCell).join(',')).join('\n')
    downloadCSV(`turnover-${new Date().toISOString().slice(0, 10)}.csv`, csv)
  }

  // Map to the growth chart's { month, total } shape — accurate: total = headcount.
  const headcountSeries = (data?.months ?? []).map((m) => ({ month: m.month, total: m.headcount }))

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
            Turnover
          </h1>
          <p className="mb-0 mt-2 text-[0.95rem] leading-snug text-[#4A5568]">
            Hires, exits, and turnover rate over the last 12 months.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={!data || loading}
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

      <section className="grid grid-cols-4 gap-4 max-[1100px]:grid-cols-2 max-[560px]:grid-cols-1" aria-label="Turnover metrics">
        <StatCard label="Hires (12 mo)" value={data ? data.totalHires : '—'} icon={UserPlus} />
        <StatCard label="Exits (12 mo)" value={data ? data.totalExits : '—'} icon={UserMinus} accent="neutral" />
        <StatCard label="Turnover rate" value={data ? `${data.turnoverRate}%` : '—'} icon={TrendingDown} accent="neutral" />
        <StatCard label="Current headcount" value={data ? data.currentHeadcount : '—'} icon={Users} />
      </section>

      <div className="mt-6">
        <EmployeeGrowthChart data={headcountSeries} />
      </div>

      {/* Hires vs exits table — the two-series detail behind the rate. */}
      <section className="mt-4 overflow-hidden rounded-[16px] border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,20,25,0.04)]" aria-label="Monthly hires and exits">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left">
                {['Month', 'Hires', 'Exits', 'Net', 'Headcount'].map((h, i) => (
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
              {loading && !data ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-[0.85rem] text-[#4A5568]">
                    Loading turnover…
                  </td>
                </tr>
              ) : (
                (data?.months ?? []).map((m) => {
                  const net = m.hires - m.exits
                  return (
                    <tr key={m.month} className="transition-colors hover:bg-slate-50/60">
                      <td className="px-4 py-3 text-[0.85rem] font-medium text-[#0F1419]">{m.month}</td>
                      <td className="px-4 py-3 text-[0.85rem] text-emerald-700 [font-family:'Geist_Mono',monospace]">
                        +{m.hires}
                      </td>
                      <td className="px-4 py-3 text-[0.85rem] text-[#B42318] [font-family:'Geist_Mono',monospace]">
                        −{m.exits}
                      </td>
                      <td className={`px-4 py-3 text-[0.85rem] [font-family:'Geist_Mono',monospace] ${net < 0 ? 'text-[#B42318]' : 'text-[#0F1419]'}`}>
                        {net > 0 ? `+${net}` : net}
                      </td>
                      <td className="px-4 py-3 text-[0.85rem] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
                        {m.headcount}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AdminLayout>
  )
}

export default TurnoverReport
