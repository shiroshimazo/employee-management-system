import { Search, X } from 'lucide-react'

/**
 * UsersToolbar — search input + role filter.
 *
 * Stateless, like EmployeesToolbar: the parent owns `query` / `role` and
 * passes setters back in. No "Add user" CTA — users arrive via self-service
 * registration, so there's nothing to create from here (see user.service).
 */

const ROLE_OPTIONS = [
  { value: '', label: 'All roles' },
  { value: 'admin', label: 'Admin' },
  { value: 'hr', label: 'HR' },
  { value: 'manager', label: 'Manager' },
  { value: 'payroll', label: 'Payroll' },
  { value: 'employee', label: 'Employee' },
]

function UsersToolbar({ query, onQueryChange, role, onRoleChange, trailing }) {
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
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search by name or phone…"
          aria-label="Search users"
          className="h-9 w-full rounded-[8px] border border-transparent bg-slate-50 pl-9 pr-9 text-[0.85rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:bg-white focus:ring-2 focus:ring-[#2C5EF5]/20"
        />
        {query ? (
          <button
            type="button"
            onClick={() => onQueryChange('')}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded-[6px] text-[#94A3B8] transition-colors hover:bg-slate-100 hover:text-[#0F1419]"
          >
            <X size={12} strokeWidth={2.25} />
          </button>
        ) : null}
      </div>

      {/* Role filter */}
      <select
        value={role}
        onChange={(e) => onRoleChange(e.target.value)}
        aria-label="Filter by role"
        className="h-9 rounded-[8px] border border-slate-200 bg-white px-2 text-[0.85rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:ring-2 focus:ring-[#2C5EF5]/20"
      >
        {ROLE_OPTIONS.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>

      {trailing ? <div className="ml-auto">{trailing}</div> : null}
    </div>
  )
}

export default UsersToolbar
