import { Calendar, Search, X } from 'lucide-react'

/**
 * AttendanceToolbar — search + status / department / date-range filters.
 *
 * Stateless: the parent owns every value and passes a setter back. Mirrors
 * EmployeesToolbar / DepartmentsToolbar / LeaveToolbar so the four screens
 * read as one product.
 *
 * Date filters bind to attendance.date (the calendar day, not check_in).
 *
 * Props mirror LeaveToolbar's escape hatches (showStatus / showType / etc.)
 * so views like "My attendance" can hide the bits that don't make sense
 * in their scope.
 */

const STATUSES = [
  { value: '', label: 'All statuses' },
  { value: 'present', label: 'Present' },
  { value: 'late', label: 'Late' },
  { value: 'absent', label: 'Absent' },
  { value: 'half_day', label: 'Half day' },
  { value: 'leave', label: 'On leave' },
  { value: 'remote', label: 'Remote' },
]

function AttendanceToolbar({
  query,
  onQueryChange,
  status,
  onStatusChange,
  departmentId,
  onDepartmentChange,
  departments = [],
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  trailing,
  showSearch = true,
  showStatus = true,
  showDepartment = true,
  showDateRange = true,
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[12px] border border-slate-200 bg-white p-2 shadow-[0_8px_24px_rgba(15,20,25,0.04)]">
      {showSearch ? (
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
            placeholder="Search by employee name…"
            aria-label="Search attendance"
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
      ) : null}

      {showDepartment ? (
        <select
          value={departmentId ?? ''}
          onChange={(e) => onDepartmentChange?.(e.target.value)}
          aria-label="Filter by department"
          className="h-9 rounded-[8px] border border-slate-200 bg-white px-2 text-[0.85rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:ring-2 focus:ring-[#2C5EF5]/20"
        >
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      ) : null}

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

      {showDateRange ? (
        <div className="flex items-center gap-1 rounded-[8px] border border-slate-200 bg-white px-2 text-[#4A5568]">
          <Calendar size={12} strokeWidth={2.25} aria-hidden="true" />
          <input
            type="date"
            value={startDate ?? ''}
            onChange={(e) => onStartDateChange?.(e.target.value)}
            aria-label="Date from"
            className="h-9 rounded-[6px] bg-transparent px-1 text-[0.8rem] text-[#0F1419] outline-none [font-family:'Geist_Mono',monospace]"
          />
          <span className="text-[#94A3B8]">→</span>
          <input
            type="date"
            value={endDate ?? ''}
            onChange={(e) => onEndDateChange?.(e.target.value)}
            min={startDate || undefined}
            aria-label="Date to"
            className="h-9 rounded-[6px] bg-transparent px-1 text-[0.8rem] text-[#0F1419] outline-none [font-family:'Geist_Mono',monospace]"
          />
          {startDate || endDate ? (
            <button
              type="button"
              onClick={() => {
                onStartDateChange?.('')
                onEndDateChange?.('')
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

export default AttendanceToolbar
