import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  AlertCircle,
  DollarSign,
  RefreshCw,
  Search,
  TrendingUp,
  Users,
  X,
} from 'lucide-react'
import PayrollLayout from '../../../layouts/PayrollLayout.jsx'
import StatCard from '../../../components/common/StatCard.jsx'
import StatusBadge from '../../../components/common/StatusBadge.jsx'
import { LoadingState } from '../../../components/common/LoadingBars.jsx'
import { getDepartments } from '../../../services/department.service.js'
import { getPayrollSalaryRecords } from '../../../services/payroll.service.js'

const MONEY = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

const INTEGER = new Intl.NumberFormat('en-US')

const STATUSES = [
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'on_leave', label: 'On Leave' },
  { value: 'probation', label: 'Probation' },
  { value: 'terminated', label: 'Terminated' },
  { value: 'inactive', label: 'Inactive' },
]

const KPI_FIELDS = [
  { key: 'totalEmployees', label: 'Records', icon: Users, formatter: formatInteger },
  { key: 'salaryTotal', label: 'Salary base', icon: DollarSign, formatter: formatMoney },
  { key: 'averageSalary', label: 'Average salary', icon: TrendingUp, formatter: formatMoney },
  { key: 'missingSalary', label: 'Missing salary', icon: AlertCircle, formatter: formatInteger, accent: 'neutral' },
]

function formatMoney(value) {
  return MONEY.format(Number(value) || 0)
}

function formatInteger(value) {
  return INTEGER.format(Number(value) || 0)
}

function formatSalary(value) {
  return value == null ? 'Not set' : formatMoney(value)
}

function initials(name) {
  if (!name) return '—'
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function SalaryManagement() {
  const [rows, setRows] = useState([])
  const [count, setCount] = useState(0)
  const [kpis, setKpis] = useState({
    totalEmployees: 0,
    salariedEmployees: 0,
    missingSalary: 0,
    salaryTotal: 0,
    averageSalary: 0,
  })
  const [departments, setDepartments] = useState([])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [departmentsError, setDepartmentsError] = useState(null)

  const reqTokenRef = useRef(0)

  const load = useCallback(async () => {
    const token = ++reqTokenRef.current
    setLoading(true)
    setError(null)

    try {
      const result = await getPayrollSalaryRecords({
        query,
        status,
        departmentId,
        limit: 100,
      })
      if (token !== reqTokenRef.current) return

      setRows(result.rows)
      setCount(result.count)
      setKpis(result.kpis)
    } catch (err) {
      if (token !== reqTokenRef.current) return

      setError(err?.message ?? 'Failed to load salary records.')
      setRows([])
      setCount(0)
      setKpis({
        totalEmployees: 0,
        salariedEmployees: 0,
        missingSalary: 0,
        salaryTotal: 0,
        averageSalary: 0,
      })
    } finally {
      if (token === reqTokenRef.current) setLoading(false)
    }
  }, [query, status, departmentId])

  useEffect(() => {
    const timer = setTimeout(load, query.trim() ? 220 : 0)
    return () => clearTimeout(timer)
  }, [load, query])

  useEffect(() => {
    let alive = true
    const timer = setTimeout(() => {
      getDepartments({ status: 'active' })
        .then((res) => {
          if (alive) setDepartments(res?.data ?? [])
        })
        .catch((err) => {
          if (alive) {
            setDepartments([])
            setDepartmentsError(err?.message ?? 'Failed to load departments.')
          }
        })
    }, 0)

    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [])

  const coverage = useMemo(() => {
    if (!kpis.totalEmployees) return '—'
    return `${Math.round((kpis.salariedEmployees / kpis.totalEmployees) * 100)}%`
  }, [kpis.salariedEmployees, kpis.totalEmployees])

  const countLabel = useMemo(() => {
    if (loading) return 'Loading records'
    if (rows.length === count) return `${formatInteger(count)} ${count === 1 ? 'record' : 'records'}`
    return `${formatInteger(rows.length)} of ${formatInteger(count)} records`
  }, [loading, rows.length, count])

  const hasFilters = query.trim() || status || departmentId

  return (
    <PayrollLayout>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="m-0 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
            Compensation
          </p>
          <h1 className="m-0 mt-2 text-[2rem] font-bold leading-[1.1] tracking-[-0.01em] text-[#0F1419] max-[600px]:text-[1.6rem]">
            Salary management
          </h1>
          <p className="mb-0 mt-2 max-w-[62ch] text-[0.95rem] leading-snug text-[#4A5568]">
            Review employee salary coverage and prepare salary records for payroll.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center gap-2 rounded-[10px] bg-white px-3 py-2 text-[0.75rem] font-medium text-[#4A5568] shadow-[0_4px_12px_rgba(15,20,25,0.04)] [font-family:'Geist_Mono',monospace]"
            aria-label="Salary record count"
          >
            <Users size={12} strokeWidth={2.25} aria-hidden="true" />
            {countLabel}
          </span>
          <button
            type="button"
            onClick={load}
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

      <section aria-label="Salary metrics">
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
                value={loading ? '—' : field.formatter(kpis[field.key])}
                icon={field.icon}
                accent={field.accent}
              />
            </motion.li>
          ))}
        </motion.ul>
      </section>

      <section className="mt-4 grid grid-cols-[minmax(0,1fr)_220px] gap-4 max-[900px]:grid-cols-1" aria-label="Salary coverage">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-[16px] border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,20,25,0.04)]"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="m-0 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
                Salary coverage
              </p>
              <p className="m-0 mt-1 text-[0.9rem] text-[#4A5568]">
                {formatInteger(kpis.salariedEmployees)} of {formatInteger(kpis.totalEmployees)} filtered records have salary data.
              </p>
            </div>
            <p className="m-0 text-[2rem] font-bold leading-none text-[#0F1419]">
              {loading ? '—' : coverage}
            </p>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-[#2C5EF5]"
              style={{
                width: !loading && kpis.totalEmployees
                  ? `${Math.round((kpis.salariedEmployees / kpis.totalEmployees) * 100)}%`
                  : '0%',
              }}
              aria-hidden="true"
            />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.04, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-[16px] border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,20,25,0.04)]"
        >
          <p className="m-0 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
            Next action
          </p>
          <p className="m-0 mt-2 text-[0.9rem] font-semibold text-[#0F1419]">
            Fill missing salaries first.
          </p>
          <p className="m-0 mt-1 text-[0.8rem] leading-snug text-[#4A5568]">
            Editing is reserved for the next todo.
          </p>
        </motion.div>
      </section>

      <SalaryToolbar
        query={query}
        onQueryChange={setQuery}
        status={status}
        onStatusChange={setStatus}
        departmentId={departmentId}
        onDepartmentChange={setDepartmentId}
        departments={departments}
        hasFilters={Boolean(hasFilters)}
        onClear={() => {
          setQuery('')
          setStatus('')
          setDepartmentId('')
        }}
      />

      {departmentsError ? (
        <p className="mt-4 rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2 text-[0.85rem] text-amber-800">
          Department filter unavailable: {departmentsError}
        </p>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-[0.85rem] text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="mt-4 overflow-hidden rounded-[16px] border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,20,25,0.04)]"
        aria-label="Salary records"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse">
            <thead>
              <tr className="text-left">
                {['Employee', 'Department', 'Type', 'Status', 'Salary', 'Coverage'].map((heading) => (
                  <th
                    key={heading}
                    className="border-b border-slate-200 bg-slate-50/60 px-4 py-3 text-[0.65rem] font-medium uppercase tracking-[0.1em] text-[#4A5568] [font-family:'Geist_Mono',monospace]"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-[0.85rem] text-[#4A5568]">
                    <LoadingState label="Loading salary records" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center">
                    <p className="m-0 text-[0.95rem] font-semibold text-[#0F1419]">
                      No salary records match.
                    </p>
                    <p className="m-0 mt-1 text-[0.85rem] text-[#4A5568]">
                      Try clearing search or filters.
                    </p>
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2C5EF5]/10 text-[0.7rem] font-semibold text-[#2C5EF5] [font-family:'Geist_Mono',monospace]"
                          aria-hidden="true"
                        >
                          {initials(row.name)}
                        </span>
                        <div className="min-w-0">
                          <p className="m-0 truncate text-[0.9rem] font-medium text-[#0F1419]">
                            {row.name}
                          </p>
                          <p className="m-0 text-[0.75rem] text-[#94A3B8] [font-family:'Geist_Mono',monospace]">
                            {row.employeeNumber} · {row.position}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[0.85rem] text-[#4A5568]">
                      <div className="min-w-0">
                        <p className="m-0 truncate text-[0.85rem] text-[#0F1419]">
                          {row.department.name}
                        </p>
                        <p className="m-0 mt-0.5 text-[0.72rem] text-[#94A3B8] [font-family:'Geist_Mono',monospace]">
                          {row.department.code ?? '—'}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge value={row.employmentType} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge value={row.status} />
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[0.9rem] font-semibold [font-family:'Geist_Mono',monospace] ${row.salary == null ? 'text-[#B42318]' : 'text-[#0F1419]'}`}>
                        {formatSalary(row.salary)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {row.salary == null ? (
                        <span className="inline-flex items-center gap-1.5 rounded-[8px] bg-red-50 px-2 py-1 text-[0.72rem] font-semibold text-red-700">
                          <AlertCircle size={12} strokeWidth={2.25} aria-hidden="true" />
                          Missing
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-[8px] bg-emerald-50 px-2 py-1 text-[0.72rem] font-semibold text-emerald-700">
                          Ready
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.section>
    </PayrollLayout>
  )
}

function SalaryToolbar({
  query,
  onQueryChange,
  status,
  onStatusChange,
  departmentId,
  onDepartmentChange,
  departments,
  hasFilters,
  onClear,
}) {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-2 rounded-[12px] border border-slate-200 bg-white p-2 shadow-[0_8px_24px_rgba(15,20,25,0.04)]">
      <div className="relative min-w-[240px] flex-1">
        <Search
          size={14}
          strokeWidth={2}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search by name, employee #, position, or department..."
          aria-label="Search salary records"
          className="h-9 w-full rounded-[8px] border border-transparent bg-slate-50 pl-9 pr-9 text-[0.85rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:bg-white focus:ring-2 focus:ring-[#2C5EF5]/20"
        />
        {query ? (
          <button
            type="button"
            onClick={() => onQueryChange('')}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-[6px] text-[#94A3B8] transition-colors hover:bg-slate-100 hover:text-[#0F1419]"
          >
            <X size={12} strokeWidth={2.25} />
          </button>
        ) : null}
      </div>

      <select
        value={departmentId}
        onChange={(event) => onDepartmentChange(event.target.value)}
        aria-label="Filter by department"
        className="h-9 rounded-[8px] border border-slate-200 bg-white px-2 text-[0.85rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:ring-2 focus:ring-[#2C5EF5]/20"
      >
        <option value="">All departments</option>
        {departments.map((department) => (
          <option key={department.id} value={department.id}>
            {department.name}
          </option>
        ))}
      </select>

      <select
        value={status}
        onChange={(event) => onStatusChange(event.target.value)}
        aria-label="Filter by status"
        className="h-9 rounded-[8px] border border-slate-200 bg-white px-2 text-[0.85rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:ring-2 focus:ring-[#2C5EF5]/20"
      >
        {STATUSES.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {hasFilters ? (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex h-9 items-center gap-1.5 rounded-[8px] border border-slate-200 bg-white px-3 text-[0.8rem] font-medium text-[#4A5568] transition-colors hover:bg-slate-50 hover:text-[#0F1419]"
        >
          <X size={13} strokeWidth={2.25} aria-hidden="true" />
          <span>Clear</span>
        </button>
      ) : null}
    </div>
  )
}

export default SalaryManagement
