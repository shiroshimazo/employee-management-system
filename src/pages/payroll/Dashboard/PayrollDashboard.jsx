import { useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  AlertCircle,
  Building2,
  DollarSign,
  FileText,
  RefreshCw,
  TrendingUp,
  Users,
} from 'lucide-react'
import PayrollLayout from '../../../layouts/PayrollLayout.jsx'
import StatCard from '../../../components/common/StatCard.jsx'
import StatusBadge from '../../../components/common/StatusBadge.jsx'
import { LoadingState } from '../../../components/common/LoadingBars.jsx'
import { useAuth } from '../../../hooks/useAuth.js'
import { usePayrollDashboard } from '../../../hooks/usePayroll.js'
import { EMPTY_PAYROLL_DASHBOARD_METRICS } from '../../../services/payroll.service.js'

const MONEY = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

const INTEGER = new Intl.NumberFormat('en-US')

const KPI_FIELDS = [
  { key: 'activePayroll', label: 'Active payroll', icon: Users, formatter: formatInteger },
  { key: 'salaryTotal', label: 'Salary base', icon: DollarSign, formatter: formatMoney },
  { key: 'averageSalary', label: 'Average salary', icon: TrendingUp, formatter: formatMoney },
  { key: 'missingSalary', label: 'Missing salaries', icon: AlertCircle, formatter: formatInteger, accent: 'neutral' },
]

function formatMoney(value) {
  return MONEY.format(Number(value) || 0)
}

function formatInteger(value) {
  return INTEGER.format(Number(value) || 0)
}

function formatTimestamp(value) {
  if (!value) return 'Waiting for data'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Updated'
  return `Updated ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
}

function PayrollDashboard() {
  const { user, profile } = useAuth()
  const { metrics, loading, error, refresh } = usePayrollDashboard()
  const dashboard = metrics ?? EMPTY_PAYROLL_DASHBOARD_METRICS

  const greetingName =
    profile?.full_name?.split(' ')[0] ??
    user?.user_metadata?.full_name?.split(' ')[0] ??
    user?.email?.split('@')[0] ??
    'there'

  const maxDepartmentCost = useMemo(
    () => Math.max(0, ...dashboard.departmentCosts.map((row) => row.salaryTotal)),
    [dashboard.departmentCosts],
  )

  return (
    <PayrollLayout>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="m-0 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
            Payroll Dashboard
          </p>
          <h1 className="m-0 mt-2 text-[2.15rem] font-bold leading-[1.1] tracking-[-0.01em] text-[#0F1419] max-[600px]:text-[1.65rem]">
            Welcome back, {greetingName}.
          </h1>
          <p className="mb-0 mt-2 max-w-[62ch] text-[0.95rem] leading-snug text-[#4A5568]">
            Salary coverage, department cost, and payroll records that need attention.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center gap-2 rounded-[10px] bg-white px-3 py-2 text-[0.75rem] font-medium text-[#4A5568] shadow-[0_4px_12px_rgba(15,20,25,0.04)] [font-family:'Geist_Mono',monospace]"
            aria-label="Payroll dashboard freshness"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            {formatTimestamp(dashboard.generatedAt)}
          </span>
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-[0.8rem] font-semibold text-[#0F1419] shadow-[0_4px_12px_rgba(15,20,25,0.04)] transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2C5EF5]"
          >
            <RefreshCw
              size={15}
              strokeWidth={2.25}
              className={loading ? 'animate-spin' : ''}
              aria-hidden="true"
            />
            <span>Refresh</span>
          </button>
        </div>
      </header>

      {error ? (
        <p className="mb-6 rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-[0.85rem] text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <section aria-label="Payroll metrics">
        <motion.ul
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
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
                  transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
                },
              }}
            >
              <StatCard
                label={field.label}
                value={loading ? '—' : field.formatter(dashboard.kpis[field.key])}
                icon={field.icon}
                accent={field.accent}
              />
            </motion.li>
          ))}
        </motion.ul>
      </section>

      <section className="mt-6 grid grid-cols-3 gap-4 max-[1100px]:grid-cols-1" aria-label="Payroll analysis">
        <Panel className="col-span-2 max-[1100px]:col-span-1" title="Department Cost" icon={Building2}>
          {loading ? (
            <LoadingState
              label="Loading department costs"
              className="text-[0.85rem] text-[#94A3B8]"
              barsClassName="h-3.5 w-5"
            />
          ) : dashboard.departmentCosts.length === 0 ? (
            <EmptyLine>No salary data found for active employees.</EmptyLine>
          ) : (
            <ul className="m-0 flex flex-col gap-3 p-0">
              {dashboard.departmentCosts.map((row) => {
                const width = maxDepartmentCost > 0
                  ? Math.max(8, Math.round((row.salaryTotal / maxDepartmentCost) * 100))
                  : 0

                return (
                  <li key={`${row.department}-${row.code ?? 'none'}`} className="rounded-[12px] border border-slate-200 bg-white p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="m-0 truncate text-[0.9rem] font-semibold text-[#0F1419]">
                          {row.department}
                        </p>
                        <p className="m-0 mt-1 text-[0.74rem] text-[#4A5568]">
                          {formatInteger(row.employees)} employee{row.employees === 1 ? '' : 's'} · avg {formatMoney(row.averageSalary)}
                        </p>
                      </div>
                      <p className="m-0 flex-none text-[0.9rem] font-bold text-[#0F1419] [font-family:'Geist_Mono',monospace]">
                        {formatMoney(row.salaryTotal)}
                      </p>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-[#2C5EF5]"
                        style={{ width: `${width}%` }}
                        aria-hidden="true"
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Status Mix" icon={FileText}>
          {loading ? (
            <LoadingState
              label="Loading status mix"
              className="text-[0.85rem] text-[#94A3B8]"
              barsClassName="h-3.5 w-5"
            />
          ) : dashboard.statusBreakdown.length === 0 ? (
            <EmptyLine>No active payroll status data yet.</EmptyLine>
          ) : (
            <ul className="m-0 flex flex-col gap-2 p-0">
              {dashboard.statusBreakdown.map((row) => (
                <li
                  key={row.status}
                  className="flex items-center justify-between gap-3 rounded-[12px] border border-slate-200 bg-white px-3 py-2"
                >
                  <div className="min-w-0">
                    <StatusBadge value={row.status} />
                    <p className="m-0 mt-1 text-[0.72rem] text-[#4A5568]">
                      {formatMoney(row.salaryTotal)}
                    </p>
                  </div>
                  <p className="m-0 flex-none text-[1.25rem] font-bold leading-none text-[#0F1419]">
                    {formatInteger(row.employees)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </section>

      <section className="mt-4 grid grid-cols-3 gap-4 max-[1100px]:grid-cols-1" aria-label="Payroll attention">
        <Panel className="col-span-2 max-[1100px]:col-span-1" title="Records Missing Salary" icon={AlertCircle}>
          {loading ? (
            <LoadingState
              label="Loading salary checks"
              className="text-[0.85rem] text-[#94A3B8]"
              barsClassName="h-3.5 w-5"
            />
          ) : dashboard.attention.missingSalaries.length === 0 ? (
            <EmptyLine>All active payroll records have salary data.</EmptyLine>
          ) : (
            <ul className="m-0 flex flex-col gap-2 p-0">
              {dashboard.attention.missingSalaries.map((row) => (
                <li
                  key={row.id}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-[12px] border border-slate-200 bg-white px-3 py-2 max-[640px]:grid-cols-1"
                >
                  <div className="min-w-0">
                    <p className="m-0 truncate text-[0.9rem] font-semibold text-[#0F1419]">
                      {row.name}
                    </p>
                    <p className="m-0 mt-1 truncate text-[0.74rem] text-[#4A5568]">
                      {row.employeeNumber} · {row.department}
                    </p>
                  </div>
                  <StatusBadge value={row.status} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Coverage" icon={Users}>
          <p className="m-0 text-[2rem] font-bold leading-none text-[#0F1419]">
            {loading || dashboard.kpis.activePayroll === 0
              ? '—'
              : `${Math.round((dashboard.kpis.salariedEmployees / dashboard.kpis.activePayroll) * 100)}%`}
          </p>
          <p className="m-0 mt-2 text-[0.85rem] leading-snug text-[#4A5568]">
            {formatInteger(dashboard.kpis.salariedEmployees)} of {formatInteger(dashboard.kpis.activePayroll)} active payroll records have salary data.
          </p>
        </Panel>
      </section>
    </PayrollLayout>
  )
}

function Panel({ title, icon: Icon, className = '', children }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={`rounded-[16px] border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,20,25,0.04)] ${className}`}
    >
      <header className="mb-4 flex items-center justify-between gap-3">
        <p className="m-0 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
          {title}
        </p>
        <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[#2C5EF5]/10 text-[#2C5EF5]" aria-hidden="true">
          <Icon size={15} strokeWidth={2.25} />
        </span>
      </header>
      {children}
    </motion.section>
  )
}

function EmptyLine({ children }) {
  return (
    <p className="m-0 rounded-[12px] border border-dashed border-slate-200 bg-slate-50/70 px-3 py-4 text-center text-[0.85rem] text-[#94A3B8]">
      {children}
    </p>
  )
}

export default PayrollDashboard
