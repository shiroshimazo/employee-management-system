import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Ban,
  CalendarDays,
  CheckCircle2,
  Filter,
  Plus,
  PlayCircle,
  RefreshCw,
  ScrollText,
  Send,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import PayrollLayout from '../../../layouts/PayrollLayout.jsx'
import StatCard from '../../../components/common/StatCard.jsx'
import StatusBadge from '../../../components/common/StatusBadge.jsx'
import Modal from '../../../components/common/Modal/Modal.jsx'
import { LoadingButtonLabel, LoadingState } from '../../../components/common/LoadingBars.jsx'
import { usePayrollRuns } from '../../../hooks/usePayroll.js'

const MONEY = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

const INTEGER = new Intl.NumberFormat('en-US')

const DATE = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

const TIME = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

const STATUSES = [
  { value: '', label: 'All runs' },
  { value: 'draft', label: 'Draft' },
  { value: 'review', label: 'Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'cancelled', label: 'Cancelled' },
]

const WORKFLOW = [
  {
    label: 'Run Payroll',
    status: 'draft',
    description: 'Draft cycles ready for review.',
    icon: PlayCircle,
  },
  {
    label: 'Review',
    status: 'review',
    description: 'Runs waiting for payroll checks.',
    icon: ScrollText,
  },
  {
    label: 'Approval',
    status: 'approved',
    description: 'Finalized payroll cycles.',
    icon: CheckCircle2,
  },
]

function formatMoney(value) {
  return MONEY.format(Number(value) || 0)
}

function formatInteger(value) {
  return INTEGER.format(Number(value) || 0)
}

function parseDate(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDate(value) {
  const date = parseDate(value)
  return date ? DATE.format(date) : 'Not set'
}

function formatTimestamp(value) {
  const date = parseDate(value)
  return date ? TIME.format(date) : 'Not recorded'
}

function formatPeriod(run) {
  return `${formatDate(run.periodStart)} - ${formatDate(run.periodEnd)}`
}

function toDateInputValue(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getDefaultPeriod() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return {
    periodStart: toDateInputValue(start),
    periodEnd: toDateInputValue(end),
  }
}

function PayrollRunList() {
  const [status, setStatus] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [reviewTarget, setReviewTarget] = useState(null)
  const [approvalTarget, setApprovalTarget] = useState(null)
  const [cancelTarget, setCancelTarget] = useState(null)
  const {
    runs,
    count,
    loading,
    error,
    refresh,
    createRun,
    submitForReview,
    approveRun,
    cancelRun,
  } = usePayrollRuns({ status })

  const statusCounts = useMemo(
    () =>
      runs.reduce(
        (acc, run) => ({
          ...acc,
          [run.status]: (acc[run.status] ?? 0) + 1,
        }),
        {},
      ),
    [runs],
  )

  const salarySnapshot = useMemo(
    () => runs.reduce((total, run) => total + run.salaryTotal, 0),
    [runs],
  )

  const employeeSnapshot = useMemo(
    () => runs.reduce((total, run) => total + run.employeeCount, 0),
    [runs],
  )

  const countLabel = useMemo(() => {
    if (loading) return 'Loading runs'
    if (runs.length === count) return `${formatInteger(count)} ${count === 1 ? 'run' : 'runs'}`
    return `${formatInteger(runs.length)} of ${formatInteger(count)} runs`
  }, [loading, runs.length, count])

  async function handleCreateRun(payload) {
    const created = await createRun(payload)
    if (status && status !== created.status) setStatus('')
    return created
  }

  async function handleSubmitForReview(runId) {
    const submitted = await submitForReview(runId)
    if (status && status !== submitted.status) setStatus('')
    return submitted
  }

  async function handleApproveRun(runId) {
    const approved = await approveRun(runId)
    if (status && status !== approved.status) setStatus('')
    return approved
  }

  async function handleCancelRun(runId) {
    const cancelled = await cancelRun(runId)
    if (status && status !== cancelled.status) setStatus('')
    return cancelled
  }

  return (
    <PayrollLayout>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="m-0 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
            PayrollRun
          </p>
          <h1 className="m-0 mt-2 text-[2rem] font-bold leading-[1.1] tracking-[-0.01em] text-[#0F1419] max-[600px]:text-[1.6rem]">
            Payroll runs
          </h1>
          <p className="mb-0 mt-2 max-w-[62ch] text-[0.95rem] leading-snug text-[#4A5568]">
            Create payroll cycles and track each run through the payroll workflow.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center gap-2 rounded-[10px] bg-white px-3 py-2 text-[0.75rem] font-medium text-[#4A5568] shadow-[0_4px_12px_rgba(15,20,25,0.04)] [font-family:'Geist_Mono',monospace]"
            aria-label="Payroll run count"
          >
            <CalendarDays size={12} strokeWidth={2.25} aria-hidden="true" />
            {countLabel}
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
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] bg-[#2C5EF5] px-3 py-2 text-[0.8rem] font-semibold text-white shadow-[0_8px_18px_rgba(44,94,245,0.22)] transition-colors hover:bg-[#1E47C9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2C5EF5]"
          >
            <Plus size={15} strokeWidth={2.25} aria-hidden="true" />
            <span>New run</span>
          </button>
        </div>
      </header>

      {error ? (
        <p className="mb-6 rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-[0.85rem] text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <section aria-label="Payroll run metrics">
        <motion.ul
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
          }}
          className="grid list-none grid-cols-4 gap-4 p-0 max-[1100px]:grid-cols-2 max-[600px]:grid-cols-1"
        >
          <MetricCard label="Run cycles" value={loading ? '-' : formatInteger(count)} icon={CalendarDays} />
          <MetricCard label="Draft runs" value={loading ? '-' : formatInteger(statusCounts.draft ?? 0)} icon={ScrollText} />
          <MetricCard label="Employee snapshot" value={loading ? '-' : formatInteger(employeeSnapshot)} icon={Users} />
          <MetricCard label="Salary snapshot" value={loading ? '-' : formatMoney(salarySnapshot)} icon={Wallet} />
        </motion.ul>
      </section>

      <section className="mt-4 grid grid-cols-3 gap-4 max-[900px]:grid-cols-1" aria-label="Payroll run workflow">
        {WORKFLOW.map((step, index) => {
          const Icon = step.icon
          return (
            <motion.article
              key={step.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.04 * index, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-[16px] border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,20,25,0.04)]"
            >
              <header className="flex items-start justify-between gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#2C5EF5]/10 text-[#2C5EF5]" aria-hidden="true">
                  <Icon size={18} strokeWidth={2.25} />
                </span>
                <span className="text-[1.3rem] font-bold leading-none text-[#0F1419] [font-family:'Geist_Mono',monospace]">
                  {loading ? '-' : formatInteger(statusCounts[step.status] ?? 0)}
                </span>
              </header>
              <p className="m-0 mt-4 text-[0.95rem] font-semibold text-[#0F1419]">
                {step.label}
              </p>
              <p className="m-0 mt-1 text-[0.85rem] leading-snug text-[#4A5568]">
                {step.description}
              </p>
            </motion.article>
          )
        })}
      </section>

      <RunToolbar
        status={status}
        onStatusChange={setStatus}
        onClear={() => setStatus('')}
      />

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="mt-4 overflow-hidden rounded-[16px] border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,20,25,0.04)]"
        aria-label="Payroll runs"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse">
            <thead>
              <tr className="text-left">
                {['Run', 'Period', 'Status', 'Employees', 'Salary snapshot', 'Created by', 'Created', ''].map((heading) => (
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
              {loading && runs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-[0.85rem] text-[#4A5568]">
                    <LoadingState label="Loading payroll runs" />
                  </td>
                </tr>
              ) : runs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center">
                    <p className="m-0 text-[0.95rem] font-semibold text-[#0F1419]">
                      No payroll runs found.
                    </p>
                    <p className="m-0 mt-1 text-[0.85rem] text-[#4A5568]">
                      Create a run or clear the status filter.
                    </p>
                  </td>
                </tr>
              ) : (
                runs.map((run) => (
                  <tr key={run.id} className="transition-colors hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <div className="min-w-0">
                        <p className="m-0 truncate text-[0.9rem] font-semibold text-[#0F1419]">
                          {run.name}
                        </p>
                        <p className="m-0 mt-1 text-[0.72rem] text-[#94A3B8] [font-family:'Geist_Mono',monospace]">
                          {run.id}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[0.85rem] text-[#4A5568]">
                      {formatPeriod(run)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge value={run.status} />
                    </td>
                    <td className="px-4 py-3 text-[0.9rem] font-semibold text-[#0F1419] [font-family:'Geist_Mono',monospace]">
                      {formatInteger(run.employeeCount)}
                    </td>
                    <td className="px-4 py-3 text-[0.9rem] font-semibold text-[#0F1419] [font-family:'Geist_Mono',monospace]">
                      {formatMoney(run.salaryTotal)}
                    </td>
                    <td className="px-4 py-3 text-[0.85rem] text-[#4A5568]">
                      {run.createdBy?.name ?? 'Unknown user'}
                    </td>
                    <td className="px-4 py-3 text-[0.85rem] text-[#4A5568]">
                      {formatTimestamp(run.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <RunActions
                        run={run}
                        onSubmitForReview={setReviewTarget}
                        onApprove={setApprovalTarget}
                        onCancel={setCancelTarget}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.section>

      <RunCreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreateRun}
      />
      <RunReviewModal
        key={reviewTarget?.id ?? 'payroll-run-review'}
        run={reviewTarget}
        open={Boolean(reviewTarget)}
        onClose={() => setReviewTarget(null)}
        onSubmit={handleSubmitForReview}
      />
      <RunApprovalModal
        key={approvalTarget?.id ?? 'payroll-run-approval'}
        run={approvalTarget}
        open={Boolean(approvalTarget)}
        onClose={() => setApprovalTarget(null)}
        onSubmit={handleApproveRun}
      />
      <RunCancelModal
        key={cancelTarget?.id ?? 'payroll-run-cancel'}
        run={cancelTarget}
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        onSubmit={handleCancelRun}
      />
    </PayrollLayout>
  )
}

function MetricCard({ label, value, icon: Icon }) {
  return (
    <motion.li
      variants={{
        hidden: { opacity: 0, y: 12 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
        },
      }}
    >
      <StatCard label={label} value={value} icon={Icon} />
    </motion.li>
  )
}

function RunToolbar({ status, onStatusChange, onClear }) {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-2 rounded-[12px] border border-slate-200 bg-white p-2 shadow-[0_8px_24px_rgba(15,20,25,0.04)]">
      <span className="inline-flex h-9 items-center gap-2 rounded-[8px] bg-slate-50 px-3 text-[0.8rem] font-medium text-[#4A5568]">
        <Filter size={14} strokeWidth={2.25} aria-hidden="true" />
        <span>Status</span>
      </span>
      <select
        value={status}
        onChange={(event) => onStatusChange(event.target.value)}
        aria-label="Filter payroll runs by status"
        className="h-9 rounded-[8px] border border-slate-200 bg-white px-2 text-[0.85rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:ring-2 focus:ring-[#2C5EF5]/20"
      >
        {STATUSES.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {status ? (
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

function RunActions({ run, onSubmitForReview, onApprove, onCancel }) {
  if (run.status === 'approved' || run.status === 'cancelled') {
    return (
      <span className="text-[0.72rem] text-[#94A3B8] [font-family:'Geist_Mono',monospace]">
        -
      </span>
    )
  }

  return (
    <div className="flex justify-end gap-1">
      {run.status === 'draft' ? (
        <button
          type="button"
          onClick={() => onSubmitForReview(run)}
          aria-label={`Submit ${run.name} for review`}
          className="inline-flex h-8 items-center gap-1.5 rounded-[8px] px-2 text-[0.78rem] font-semibold text-[#4A5568] transition-colors hover:bg-slate-100 hover:text-[#0F1419] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2C5EF5]"
        >
          <Send size={13} strokeWidth={2.25} aria-hidden="true" />
          <span>Submit</span>
        </button>
      ) : null}

      {run.status === 'review' ? (
        <button
          type="button"
          onClick={() => onApprove(run)}
          aria-label={`Approve ${run.name}`}
          className="inline-flex h-8 items-center gap-1.5 rounded-[8px] px-2 text-[0.78rem] font-semibold text-[#166534] transition-colors hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2C5EF5]"
        >
          <CheckCircle2 size={13} strokeWidth={2.25} aria-hidden="true" />
          <span>Approve</span>
        </button>
      ) : null}

      <button
        type="button"
        onClick={() => onCancel(run)}
        aria-label={`Cancel ${run.name}`}
        className="inline-flex h-8 items-center gap-1.5 rounded-[8px] px-2 text-[0.78rem] font-semibold text-red-700 transition-colors hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2C5EF5]"
      >
        <Ban size={13} strokeWidth={2.25} aria-hidden="true" />
        <span>Cancel</span>
      </button>
    </div>
  )
}

function RunCreateModal({ open, onClose, onSubmit }) {
  const defaults = useMemo(getDefaultPeriod, [])
  const [name, setName] = useState('')
  const [periodStart, setPeriodStart] = useState(defaults.periodStart)
  const [periodEnd, setPeriodEnd] = useState(defaults.periodEnd)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const missingDates = !periodStart || !periodEnd
  const invalidRange = Boolean(periodStart && periodEnd && periodEnd < periodStart)

  async function handleSubmit(event) {
    event.preventDefault()

    if (missingDates) {
      setError('Period start and end are required.')
      return
    }

    if (invalidRange) {
      setError('Period end must be on or after the start date.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        name,
        periodStart,
        periodEnd,
      })
      setName('')
      setPeriodStart(defaults.periodStart)
      setPeriodEnd(defaults.periodEnd)
      onClose?.()
    } catch (err) {
      setError(err?.message ?? 'Could not create this payroll run.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onClose}
      size="sm"
      title="New payroll run"
      description="Create a draft payroll cycle using the current active employee salary snapshot."
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="inline-flex h-9 items-center rounded-[8px] border border-slate-200 bg-white px-3 text-[0.8rem] font-medium text-[#4A5568] transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="payroll-run-create-form"
            disabled={submitting || missingDates || invalidRange}
            className="inline-flex h-9 items-center rounded-[8px] bg-[#2C5EF5] px-3 text-[0.8rem] font-semibold text-white transition-colors hover:bg-[#1E47C9] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? <LoadingButtonLabel label="Creating" /> : 'Create run'}
          </button>
        </>
      }
    >
      <form id="payroll-run-create-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-[0.7rem] font-medium uppercase tracking-[0.1em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
            Run name
          </span>
          <input
            type="text"
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              if (error) setError(null)
            }}
            placeholder="Generated when left blank"
            className="h-10 rounded-[8px] border border-slate-200 bg-white px-3 text-[0.9rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:ring-2 focus:ring-[#2C5EF5]/20"
          />
        </label>

        <div className="grid grid-cols-2 gap-3 max-[560px]:grid-cols-1">
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.7rem] font-medium uppercase tracking-[0.1em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
              Period start
            </span>
            <input
              type="date"
              value={periodStart}
              onChange={(event) => {
                setPeriodStart(event.target.value)
                if (error) setError(null)
              }}
              className="h-10 rounded-[8px] border border-slate-200 bg-white px-3 text-[0.9rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:ring-2 focus:ring-[#2C5EF5]/20"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[0.7rem] font-medium uppercase tracking-[0.1em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
              Period end
            </span>
            <input
              type="date"
              value={periodEnd}
              onChange={(event) => {
                setPeriodEnd(event.target.value)
                if (error) setError(null)
              }}
              className="h-10 rounded-[8px] border border-slate-200 bg-white px-3 text-[0.9rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:ring-2 focus:ring-[#2C5EF5]/20"
            />
          </label>
        </div>

        <div className="rounded-[12px] border border-slate-200 bg-slate-50/70 p-3">
          <p className="m-0 text-[0.75rem] font-medium uppercase tracking-[0.1em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
            Snapshot source
          </p>
          <p className="m-0 mt-1 text-[0.85rem] leading-snug text-[#4A5568]">
            Active employee records with current salary values.
          </p>
        </div>

        {invalidRange ? (
          <p className="m-0 rounded-[8px] bg-red-50 px-3 py-2 text-[0.8rem] text-red-700">
            Period end must be on or after the start date.
          </p>
        ) : null}

        {error ? (
          <p className="m-0 rounded-[8px] bg-red-50 px-3 py-2 text-[0.8rem] text-red-700" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </Modal>
  )
}

function RunCancelModal({ run, open, onClose, onSubmit }) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  if (!run) return null

  async function handleSubmit(event) {
    event.preventDefault()

    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(run.id)
      onClose?.()
    } catch (err) {
      setError(err?.message ?? 'Could not cancel this payroll run.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onClose}
      size="sm"
      title="Cancel payroll run"
      description="Move this payroll run out of the active workflow."
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="inline-flex h-9 items-center rounded-[8px] border border-slate-200 bg-white px-3 text-[0.8rem] font-medium text-[#4A5568] transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Keep run
          </button>
          <button
            type="submit"
            form="payroll-run-cancel-form"
            disabled={submitting}
            className="inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-red-600 px-3 text-[0.8rem] font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? <LoadingButtonLabel label="Cancelling" /> : 'Cancel run'}
          </button>
        </>
      }
    >
      <form id="payroll-run-cancel-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="rounded-[12px] border border-slate-200 bg-slate-50/70 p-3">
          <p className="m-0 text-[0.9rem] font-semibold text-[#0F1419]">
            {run.name}
          </p>
          <p className="m-0 mt-1 text-[0.75rem] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
            {formatPeriod(run)}
          </p>
        </div>

        <p className="m-0 rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-[0.8rem] leading-snug text-red-800">
          This will mark the run as cancelled. Approved runs cannot be cancelled.
        </p>

        {error ? (
          <p className="m-0 rounded-[8px] bg-red-50 px-3 py-2 text-[0.8rem] text-red-700" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </Modal>
  )
}

function RunReviewModal({ run, open, onClose, onSubmit }) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  if (!run) return null

  async function handleSubmit(event) {
    event.preventDefault()

    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(run.id)
      onClose?.()
    } catch (err) {
      setError(err?.message ?? 'Could not submit this payroll run for review.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onClose}
      size="sm"
      title="Submit for review"
      description="Move this draft payroll run into the review stage."
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="inline-flex h-9 items-center rounded-[8px] border border-slate-200 bg-white px-3 text-[0.8rem] font-medium text-[#4A5568] transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="payroll-run-review-form"
            disabled={submitting}
            className="inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-[#2C5EF5] px-3 text-[0.8rem] font-semibold text-white transition-colors hover:bg-[#1E47C9] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? <LoadingButtonLabel label="Submitting" /> : 'Submit'}
          </button>
        </>
      }
    >
      <form id="payroll-run-review-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="rounded-[12px] border border-slate-200 bg-slate-50/70 p-3">
          <p className="m-0 text-[0.9rem] font-semibold text-[#0F1419]">
            {run.name}
          </p>
          <p className="m-0 mt-1 text-[0.75rem] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
            {formatPeriod(run)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-[10px] border border-slate-200 bg-white p-3">
            <p className="m-0 text-[0.7rem] font-medium uppercase tracking-[0.1em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
              Employees
            </p>
            <p className="m-0 mt-1 text-[1.15rem] font-bold leading-none text-[#0F1419]">
              {formatInteger(run.employeeCount)}
            </p>
          </div>
          <div className="rounded-[10px] border border-slate-200 bg-white p-3">
            <p className="m-0 text-[0.7rem] font-medium uppercase tracking-[0.1em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
              Salary
            </p>
            <p className="m-0 mt-1 text-[1.15rem] font-bold leading-none text-[#0F1419]">
              {formatMoney(run.salaryTotal)}
            </p>
          </div>
        </div>

        {error ? (
          <p className="m-0 rounded-[8px] bg-red-50 px-3 py-2 text-[0.8rem] text-red-700" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </Modal>
  )
}

function RunApprovalModal({ run, open, onClose, onSubmit }) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  if (!run) return null

  async function handleSubmit(event) {
    event.preventDefault()

    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(run.id)
      onClose?.()
    } catch (err) {
      setError(err?.message ?? 'Could not approve this payroll run.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onClose}
      size="sm"
      title="Approve payroll run"
      description="Finalize this reviewed payroll run and record the approval."
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="inline-flex h-9 items-center rounded-[8px] border border-slate-200 bg-white px-3 text-[0.8rem] font-medium text-[#4A5568] transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="payroll-run-approval-form"
            disabled={submitting}
            className="inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-emerald-600 px-3 text-[0.8rem] font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? <LoadingButtonLabel label="Approving" /> : 'Approve run'}
          </button>
        </>
      }
    >
      <form id="payroll-run-approval-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="rounded-[12px] border border-slate-200 bg-slate-50/70 p-3">
          <p className="m-0 text-[0.9rem] font-semibold text-[#0F1419]">
            {run.name}
          </p>
          <p className="m-0 mt-1 text-[0.75rem] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
            {formatPeriod(run)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-[10px] border border-slate-200 bg-white p-3">
            <p className="m-0 text-[0.7rem] font-medium uppercase tracking-[0.1em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
              Employees
            </p>
            <p className="m-0 mt-1 text-[1.15rem] font-bold leading-none text-[#0F1419]">
              {formatInteger(run.employeeCount)}
            </p>
          </div>
          <div className="rounded-[10px] border border-slate-200 bg-white p-3">
            <p className="m-0 text-[0.7rem] font-medium uppercase tracking-[0.1em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
              Salary
            </p>
            <p className="m-0 mt-1 text-[1.15rem] font-bold leading-none text-[#0F1419]">
              {formatMoney(run.salaryTotal)}
            </p>
          </div>
        </div>

        <p className="m-0 rounded-[10px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-[0.8rem] leading-snug text-emerald-800">
          Approval will lock this run into the approved status and record your profile as the approver.
        </p>

        {error ? (
          <p className="m-0 rounded-[8px] bg-red-50 px-3 py-2 text-[0.8rem] text-red-700" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </Modal>
  )
}

export default PayrollRunList
