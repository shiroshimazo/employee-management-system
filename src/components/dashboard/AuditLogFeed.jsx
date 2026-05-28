import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Archive,
  Building2,
  Check,
  CircleDollarSign,
  Pencil,
} from 'lucide-react'
import { getAuditLog } from '../../services/dashboardService.js'

// Action → icon + tone map. Centralizing this means new audit actions only
// need an entry here, not a switch buried in the render path.
const ACTION_META = {
  updated_employee: { Icon: Pencil, tone: 'text-blue-700 bg-blue-50', label: 'Updated employee' },
  leave_approved: { Icon: Check, tone: 'text-emerald-700 bg-emerald-50', label: 'Leave approved' },
  created_department: { Icon: Building2, tone: 'text-teal-700 bg-teal-50', label: 'Created department' },
  archived_employee: { Icon: Archive, tone: 'text-slate-600 bg-slate-100', label: 'Archived employee' },
  payroll_run: { Icon: CircleDollarSign, tone: 'text-amber-700 bg-amber-50', label: 'Payroll run' },
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.round(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  return `${d}d ago`
}

/**
 * AuditLogFeed — chronological feed of recent admin / system actions.
 *
 * Built as a vertical timeline because the eye reads "who did what to
 * whom, when" most easily down a list. Icons categorize the action class
 * at a glance without needing labels in front of each entry.
 */
function AuditLogFeed({ delay = 0 }) {
  const [items, setItems] = useState([])

  useEffect(() => {
    let alive = true
    getAuditLog().then((d) => alive && setItems(d))
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
      aria-label="Recent activity"
    >
      <header className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
            Recent activity
          </p>
          <p className="m-0 mt-1 text-[0.85rem] text-[#4A5568]">Audit log feed</p>
        </div>
        <a
          href="/admin/audit"
          className="text-[0.75rem] font-medium text-[#2C5EF5] hover:text-[#1E47C9]"
        >
          View all
        </a>
      </header>

      <ol className="m-0 flex flex-col gap-3 p-0">
        {items.map((it) => {
          const meta = ACTION_META[it.action] ?? {
            Icon: Pencil,
            tone: 'text-slate-600 bg-slate-100',
            label: it.action,
          }
          const Icon = meta.Icon
          return (
            <li key={it.id} className="flex items-start gap-3">
              <span
                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] ${meta.tone}`}
                aria-hidden="true"
              >
                <Icon size={15} strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="m-0 text-[0.85rem] leading-snug text-[#0F1419]">
                  <span className="font-semibold">{it.actor}</span>{' '}
                  <span className="text-[#4A5568]">{meta.label.toLowerCase()}</span>{' '}
                  <span className="font-semibold">{it.target}</span>
                </p>
                {it.meta ? (
                  <p className="m-0 mt-0.5 text-[0.78rem] text-[#4A5568]">{it.meta}</p>
                ) : null}
              </div>
              <span className="shrink-0 text-[0.7rem] text-[#94A3B8] [font-family:'Geist_Mono',monospace]">
                {timeAgo(it.at)}
              </span>
            </li>
          )
        })}
      </ol>
    </motion.section>
  )
}

export default AuditLogFeed
