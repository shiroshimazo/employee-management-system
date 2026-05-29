import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Archive,
  CalendarCheck,
  Check,
  Clock4,
  Pencil,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react'
import { getAuditLogs } from '../../services/audit.service.js'

// Action → icon + tone + label map, keyed by the real audit vocabulary the
// services emit (see leave/attendance/user services). New audit actions only
// need an entry here, not a switch in the render path.
const ACTION_META = {
  'leave_request.created': { Icon: CalendarCheck, tone: 'text-blue-700 bg-blue-50', label: 'Requested leave' },
  'leave_request.approved': { Icon: Check, tone: 'text-emerald-700 bg-emerald-50', label: 'Approved leave' },
  'leave_request.rejected': { Icon: X, tone: 'text-red-700 bg-red-50', label: 'Rejected leave' },
  'leave_request.cancelled': { Icon: Archive, tone: 'text-slate-600 bg-slate-100', label: 'Cancelled leave' },
  'attendance.clocked_in': { Icon: Clock4, tone: 'text-teal-700 bg-teal-50', label: 'Clocked in' },
  'attendance.clocked_out': { Icon: Clock4, tone: 'text-slate-600 bg-slate-100', label: 'Clocked out' },
  'attendance.edited': { Icon: Pencil, tone: 'text-blue-700 bg-blue-50', label: 'Edited attendance' },
  'attendance.deleted': { Icon: Trash2, tone: 'text-red-700 bg-red-50', label: 'Deleted attendance' },
  'user.role_changed': { Icon: ShieldCheck, tone: 'text-violet-700 bg-violet-50', label: 'Changed role' },
}

function humanize(value) {
  return String(value)
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// Short context line built from the row's meta, so each entry says a bit more
// than just the action. Returns null when there's nothing useful to add.
function summarize(action, meta) {
  if (!meta || typeof meta !== 'object') return null
  if (action.startsWith('leave_request.')) {
    const parts = []
    if (meta.leave_type) parts.push(humanize(meta.leave_type))
    if (meta.days) parts.push(`${meta.days} ${meta.days === 1 ? 'day' : 'days'}`)
    if (meta.decision_note) parts.push(meta.decision_note)
    return parts.join(' · ') || null
  }
  if (action.startsWith('attendance.')) {
    if (meta.date) return meta.date
    if (Array.isArray(meta.fields) && meta.fields.length) return meta.fields.join(', ')
    return null
  }
  if (action === 'user.role_changed') {
    return meta.role ? `→ ${humanize(meta.role)}` : null
  }
  return null
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
 * Built as a vertical timeline because the eye reads "who did what, when"
 * most easily down a list. Pulls the real audit_logs (newest first) via
 * audit.service; icons categorize the action class at a glance.
 */
function AuditLogFeed({ delay = 0 }) {
  const [items, setItems] = useState([])

  useEffect(() => {
    let alive = true
    getAuditLogs({ limit: 6 })
      .then((d) => alive && setItems(d ?? []))
      .catch(() => alive && setItems([]))
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

      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 rounded-[12px] border border-dashed border-slate-200 bg-slate-50/40 px-4 py-10 text-center">
          <p className="m-0 text-[0.95rem] font-semibold text-[#0F1419]">No activity yet.</p>
          <p className="m-0 text-[0.85rem] text-[#4A5568]">
            Actions across the app will show up here.
          </p>
        </div>
      ) : (
        <ol className="m-0 flex flex-col gap-3 p-0">
          {items.map((it) => {
            const meta = ACTION_META[it.action] ?? {
              Icon: Pencil,
              tone: 'text-slate-600 bg-slate-100',
              label: humanize(it.action),
            }
            const Icon = meta.Icon
            const actorName = it.actor?.full_name ?? 'System'
            const detail = summarize(it.action, it.meta)
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
                    <span className="font-semibold">{actorName}</span>{' '}
                    <span className="text-[#4A5568]">{meta.label.toLowerCase()}</span>
                  </p>
                  {detail ? (
                    <p className="m-0 mt-0.5 truncate text-[0.78rem] text-[#4A5568]">{detail}</p>
                  ) : null}
                </div>
                <span className="shrink-0 text-[0.7rem] text-[#94A3B8] [font-family:'Geist_Mono',monospace]">
                  {timeAgo(it.created_at)}
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </motion.section>
  )
}

export default AuditLogFeed
