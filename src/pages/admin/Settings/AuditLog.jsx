import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Archive,
  CalendarCheck,
  Check,
  Clock4,
  Pencil,
  ScrollText,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react'
import AdminLayout from '../../../layouts/AdminLayout.jsx'
import { LoadingState } from '../../../components/common/LoadingBars.jsx'
import { getAuditLogs } from '../../../services/audit.service.js'

/**
 * AuditLog — read-only viewer for the audit_logs table.
 *
 * audit_logs is append-only (migration 007 defines no UPDATE/DELETE policies),
 * so this is a viewer, not a CRUD surface: filter + read, nothing to mutate.
 *
 * Mirrors the other admin list pages (AttendanceListPage):
 *   - action-type filter applies server-side via getAuditLogs({ action })
 *   - free-text search over actor name / target runs client-side on top
 *   - the same race-guarded request-token + debounce pattern
 */

// Action → icon + tone + label, keyed by the real vocabulary the services
// emit (leave/attendance/user). Drives both the row icon and the filter
// dropdown, so a new action only needs one entry here.
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

const ACTION_OPTIONS = [
  { value: '', label: 'All actions' },
  ...Object.entries(ACTION_META).map(([value, meta]) => ({ value, label: meta.label })),
]

function humanize(value) {
  return String(value)
    .split(/[_.]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function initials(name) {
  if (!name) return '–'
  return name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

// Short context line built from the row's meta — same shape as the dashboard
// feed, so an entry reads the same in both places.
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

function formatWhen(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function AuditLog() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Toolbar state
  const [query, setQuery] = useState('')
  const [action, setAction] = useState('')

  // Race guard so a fast typist's prior fetch can't overwrite a newer one.
  const reqTokenRef = useRef(0)

  const load = useCallback(async () => {
    const token = ++reqTokenRef.current
    setLoading(true)
    setError(null)
    try {
      const data = await getAuditLogs({ action: action || undefined, limit: 200 })
      if (token !== reqTokenRef.current) return
      let result = data ?? []
      // Free-text search → client-side over the actor name + target table.
      if (query.trim()) {
        const term = query.trim().toLowerCase()
        result = result.filter((r) => {
          const actor = (r.actor?.full_name ?? '').toLowerCase()
          const target = (r.target_table ?? '').toLowerCase()
          return actor.includes(term) || target.includes(term)
        })
      }
      setRows(result)
    } catch (err) {
      if (token !== reqTokenRef.current) return
      setError(err?.message ?? 'Failed to load the audit log.')
      setRows([])
    } finally {
      if (token === reqTokenRef.current) setLoading(false)
    }
  }, [query, action])

  // Debounce search keystrokes; action filter changes refetch immediately.
  useEffect(() => {
    const t = setTimeout(load, query.trim() ? 220 : 0)
    return () => clearTimeout(t)
  }, [load, query])

  const totalLabel = useMemo(() => {
    if (loading) {
      return <LoadingState label="Loading" barsClassName="h-3 w-5" />
    }
    return `${rows.length} ${rows.length === 1 ? 'entry' : 'entries'}`
  }, [loading, rows.length])

  return (
    <AdminLayout>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="m-0 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
            Audit Log
          </p>
          <h1 className="m-0 mt-2 text-[2rem] font-bold leading-[1.1] tracking-[-0.01em] text-[#0F1419] max-[600px]:text-[1.6rem]">
            Activity &amp; audit trail
          </h1>
          <p className="mb-0 mt-2 text-[0.95rem] leading-snug text-[#4A5568]">
            A record of privileged actions across the system. Append-only — entries can’t be edited or removed.
          </p>
        </div>
        <span
          className="inline-flex items-center gap-2 rounded-[10px] bg-white px-3 py-2 text-[0.75rem] font-medium text-[#4A5568] shadow-[0_4px_12px_rgba(15,20,25,0.04)] [font-family:'Geist_Mono',monospace]"
          aria-label="Total entries"
        >
          <ScrollText size={12} strokeWidth={2.25} aria-hidden="true" />
          {totalLabel}
        </span>
      </header>

      {/* Toolbar: search + action filter */}
      <div className="flex flex-wrap items-center gap-2 rounded-[12px] border border-slate-200 bg-white p-2 shadow-[0_8px_24px_rgba(15,20,25,0.04)]">
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
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by actor or target…"
            aria-label="Search audit log"
            className="h-9 w-full rounded-[8px] border border-transparent bg-slate-50 pl-9 pr-9 text-[0.85rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:bg-white focus:ring-2 focus:ring-[#2C5EF5]/20"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded-[6px] text-[#94A3B8] transition-colors hover:bg-slate-100 hover:text-[#0F1419]"
            >
              <X size={12} strokeWidth={2.25} />
            </button>
          ) : null}
        </div>

        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          aria-label="Filter by action"
          className="h-9 rounded-[8px] border border-slate-200 bg-white px-2 text-[0.85rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:ring-2 focus:ring-[#2C5EF5]/20"
        >
          {ACTION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <p className="mt-4 rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-[0.85rem] text-red-700">
          {error}
        </p>
      ) : null}

      {/* Table */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="mt-4 overflow-hidden rounded-[16px] border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,20,25,0.04)]"
        aria-label="Audit log"
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left">
                {['Actor', 'Action', 'Target', 'Details', 'When'].map((h, i) => (
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
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-[0.85rem] text-[#4A5568]">
                    <LoadingState label="Loading audit log" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center">
                    <p className="m-0 text-[0.95rem] font-semibold text-[#0F1419]">
                      No audit entries match.
                    </p>
                    <p className="m-0 mt-1 text-[0.85rem] text-[#4A5568]">
                      Try clearing the search or action filter.
                    </p>
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const meta = ACTION_META[r.action] ?? {
                    Icon: Pencil,
                    tone: 'text-slate-600 bg-slate-100',
                    label: humanize(r.action),
                  }
                  const Icon = meta.Icon
                  const actorName = r.actor?.full_name ?? 'System'
                  const detail = summarize(r.action, r.meta)
                  return (
                    <tr key={r.id} className="transition-colors hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2C5EF5]/10 text-[0.7rem] font-semibold text-[#2C5EF5] [font-family:'Geist_Mono',monospace]"
                            aria-hidden="true"
                          >
                            {initials(r.actor?.full_name)}
                          </span>
                          <div className="min-w-0">
                            <p className="m-0 truncate text-[0.9rem] font-medium text-[#0F1419]">
                              {actorName}
                            </p>
                            {r.actor?.role ? (
                              <p className="m-0 text-[0.75rem] text-[#94A3B8] [font-family:'Geist_Mono',monospace]">
                                {r.actor.role}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2">
                          <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] ${meta.tone}`}
                            aria-hidden="true"
                          >
                            <Icon size={14} strokeWidth={2} />
                          </span>
                          <span className="text-[0.85rem] text-[#0F1419]">{meta.label}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[0.8rem] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
                        {r.target_table ? humanize(r.target_table) : '—'}
                      </td>
                      <td className="max-w-[280px] px-4 py-3 text-[0.85rem] text-[#4A5568]">
                        <span className="line-clamp-2">{detail ?? '—'}</span>
                      </td>
                      <td className="px-4 py-3 text-[0.8rem] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
                        {formatWhen(r.created_at)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </motion.section>
    </AdminLayout>
  )
}

export default AuditLog
