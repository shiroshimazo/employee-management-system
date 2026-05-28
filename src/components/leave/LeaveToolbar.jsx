import { Calendar, Search, X } from 'lucide-react'

/**
 * LeaveToolbar — search input + status / type / date-range filters.
 *
 * Stateless: the parent owns every value and passes a setter back. Mirrors
 * EmployeesToolbar and DepartmentsToolbar so the three admin screens read
 * as one product.
 *
 * Date filters bind to the request's `start_date`. We use two date inputs
 * (from / to) instead of a fancy range picker — native inputs are
 * accessible, mobile-friendly, and free.
 *
 * Props:
 *   query, onQueryChange
 *   status, onStatusChange
 *   leaveType, onLeaveTypeChange
 *   startFrom, onStartFromChange
 *   startTo, onStartToChange
 *   trailing — optional ReactNode rendered on the right (e.g. "Submit" CTA)
 *   showStatus / showType — escape hatches for views that don't need them
 *     (e.g. "My pending" page hides the status filter).
 */

const STATUSES = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
]

const LEAVE_TYPES = [
  { value: '', label: 'All types' },
  { value: 'vacation', label: 'Vacation' },
  { value: 'sick', label: 'Sick' },
  { value: 'personal', label: 'Personal' },
  { value: 'bereavement', label: 'Bereavement' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'maternity', label: 'Maternity' },
  { value: 'paternity', label: 'Paternity' },
]

function LeaveToolbar({
  query,
  onQueryChange,
  status,
  onStatusChange,
  leaveType,
  onLeaveTypeChange,
  startFrom,
  onStartFromChange,
  startTo,
  onStartToChange,
  trailing,
  showStatus = true,
  showType = true,
  showDateRange = true,
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[12px] border border-slate-200 bg-white p-2 shadow-[0_8px_24px_rgba(15,20,25,0.04)]">
      {/* Search */}
      <div className="relative flex-1 min-w-[220px]">
        <Search
          size={14}
          strokeWidth={2}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query ?? ''}
          onChange={(e) => onQueryChange?.(e.target.value)}
          placeholder="Search by employee name or reason…"
          aria-label="Search leave requests"
          className="h-9 w-full rounded-[8px] border border-transparent bg-slate-50 pl-9 pr-9 text-[0.85rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:bg-white focus:ring-2 focus:ring-[#2C5EF5]/20"
        />
        {query ? (
          <button
            type="button"
            onClick={() => onQueryChange?.('')}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded-[6px] text-[#94A3B8] transition-colors hover:bg-slate-100 hover:text-[#0F1419]"
          >
            <X size={12} strokeWidth={2.25} />
          </button>
        ) : null}
      </div>

      {/* Type filter */}
      {showType ? (
        <select
          value={leaveType ?? ''}
          onChange={(e) => onLeaveTypeChange?.(e.target.value)}
          aria-label="Filter by leave type"
          className="h-9 rounded-[8px] border border-slate-200 bg-white px-2 text-[0.85rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:ring-2 focus:ring-[#2C5EF5]/20"
        >
          {LEAVE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      ) : null}

      {/* Status filter */}
      {showStatus ? (
        <select
          value={status ?? ''}
          onChange={(e) => onStatusChange?.(e.target.value)}
          aria-label="Filter by status"
          className="h-9 rounded-[8px] border border-slate-200 bg-white px-2 text-[0.85rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:ring-2 focus:ring-[#2C5EF5]/20"
        >
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      ) : null}

      {/* Date range — From / To. Filters by start_date so users can find
          requests that *start* in a given window. */}
      {showDateRange ? (
        <div className="flex items-center gap-1 rounded-[8px] border border-slate-200 bg-white px-2 text-[#4A5568]">
          <Calendar size={12} strokeWidth={2.25} aria-hidden="true" />
          <input
            type="date"
            value={startFrom ?? ''}
            onChange={(e) => onStartFromChange?.(e.target.value)}
            aria-label="Start date from"
            className="h-9 rounded-[6px] bg-transparent px-1 text-[0.8rem] text-[#0F1419] outline-none [font-family:'Geist_Mono',monospace]"
          />
          <span className="text-[#94A3B8]">→</span>
          <input
            type="date"
            value={startTo ?? ''}
            onChange={(e) => onStartToChange?.(e.target.value)}
            min={startFrom || undefined}
            aria-label="Start date to"
            className="h-9 rounded-[6px] bg-transparent px-1 text-[0.8rem] text-[#0F1419] outline-none [font-family:'Geist_Mono',monospace]"
          />
          {startFrom || startTo ? (
            <button
              type="button"
              onClick={() => {
                onStartFromChange?.('')
                onStartToChange?.('')
              }}
              aria-label="Clear date range"
              className="inline-flex h-6 w-6 items-center justify-center rounded-[6px] text-[#94A3B8] transition-colors hover:bg-slate-100 hover:text-[#0F1419]"
            >
              <X size={12} strokeWidth={2.25} />
            </button>
          ) : null}
        </div>
      ) : null}

      {trailing ? <div className="ml-auto">{trailing}</div> : null}
    </div>
  )
}

export default LeaveToolbar
