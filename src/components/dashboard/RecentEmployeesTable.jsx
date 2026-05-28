import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'
import { getRecentEmployees } from '../../services/dashboardService.js'

// One place for the status chip palette so the table and any future filter
// chip read from the same vocabulary.
const STATUS_TONE = {
  Active: 'bg-emerald-50 text-emerald-700',
  Probation: 'bg-amber-50 text-amber-700',
  'On Leave': 'bg-blue-50 text-blue-700',
  Inactive: 'bg-slate-100 text-slate-600',
}

function formatJoined(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function initials(name) {
  return name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

/**
 * RecentEmployeesTable — last few hires with quick context.
 *
 * Lists fields the HR admin actually scans for: name, role, department,
 * joined date, status. Avatars are initials-on-tint so we don't need to
 * fetch images yet — drop in a real avatar URL when the employee record
 * grows one.
 */
function RecentEmployeesTable({ delay = 0 }) {
  const [rows, setRows] = useState([])

  useEffect(() => {
    let alive = true
    getRecentEmployees().then((d) => alive && setRows(d))
    return () => {
      alive = false
    }
  }, [])

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
      className="flex h-full flex-col gap-4 rounded-[16px] border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,20,25,0.04)]"
      aria-label="Recent employees"
    >
      <header className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
            Recent employees
          </p>
          <p className="m-0 mt-1 text-[0.85rem] text-[#4A5568]">
            Latest joiners across the organization
          </p>
        </div>
        <a
          href="/admin/employees"
          className="inline-flex items-center gap-1 text-[0.75rem] font-medium text-[#2C5EF5] hover:text-[#1E47C9]"
        >
          View all
          <ArrowUpRight size={14} strokeWidth={2.25} aria-hidden="true" />
        </a>
      </header>

      <div className="-mx-2 overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-left">
              {['Employee', 'Role', 'Department', 'Joined', 'Status'].map((h) => (
                <th
                  key={h}
                  className="border-b border-slate-200 px-2 py-2 text-[0.65rem] font-medium uppercase tracking-[0.1em] text-[#4A5568] [font-family:'Geist_Mono',monospace]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className="transition-colors hover:bg-slate-50/60"
              >
                <td className="px-2 py-3">
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2C5EF5]/10 text-[0.7rem] font-semibold text-[#2C5EF5] [font-family:'Geist_Mono',monospace]"
                      aria-hidden="true"
                    >
                      {initials(r.name)}
                    </span>
                    <span className="text-[0.9rem] font-medium text-[#0F1419]">
                      {r.name}
                    </span>
                  </div>
                </td>
                <td className="px-2 py-3 text-[0.85rem] text-[#4A5568]">{r.role}</td>
                <td className="px-2 py-3 text-[0.85rem] text-[#4A5568]">
                  {r.department}
                </td>
                <td className="px-2 py-3 text-[0.8rem] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
                  {formatJoined(r.joinedAt)}
                </td>
                <td className="px-2 py-3">
                  <span
                    className={`inline-flex items-center rounded-[6px] px-2 py-1 text-[0.7rem] font-semibold ${
                      STATUS_TONE[r.status] ?? 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.section>
  )
}

export default RecentEmployeesTable
