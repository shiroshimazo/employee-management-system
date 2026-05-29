import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { CalendarClock } from 'lucide-react'
import { getLeaveRequests } from '../../services/leave.service.js'
import StatusBadge from '../common/StatusBadge.jsx'

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

function formatRange(from, to) {
  const f = new Date(from)
  const t = new Date(to)
  const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return f.toDateString() === t.toDateString() ? fmt(f) : `${fmt(f)} – ${fmt(t)}`
}

function daysUntil(iso) {
  const ms = new Date(iso).getTime() - Date.now()
  const d = Math.ceil(ms / (1000 * 60 * 60 * 24))
  if (d <= 0) return 'Today'
  if (d === 1) return 'Tomorrow'
  return `In ${d} days`
}

/**
 * UpcomingLeaveList — who's scheduled to be out next.
 *
 * Repurposed from the old mock "HR events" widget: there's no events table in
 * the schema, but approved leave with a future start date is real, useful
 * forward-looking data. Pulls approved requests starting today or later,
 * soonest first, so an admin can see upcoming absences at a glance.
 */
function UpcomingLeaveList({ delay = 0 }) {
  const [items, setItems] = useState([])

  useEffect(() => {
    let alive = true
    const today = new Date().toISOString().slice(0, 10)
    getLeaveRequests({ status: 'approved', startFrom: today, limit: 50 })
      .then((res) => {
        if (!alive) return
        // Sort by start_date ascending so the soonest upcoming leave is on top,
        // then keep the next few.
        const sorted = [...(res.data ?? [])].sort(
          (a, b) => new Date(a.start_date) - new Date(b.start_date),
        )
        setItems(sorted.slice(0, 5))
      })
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
      aria-label="Upcoming leave"
    >
      <header className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
            Upcoming leave
          </p>
          <p className="m-0 mt-1 text-[0.85rem] text-[#4A5568]">
            Who's scheduled to be out next
          </p>
        </div>
        <span
          className="inline-flex items-center gap-1.5 rounded-[8px] bg-[#F1F3F5] px-2 py-1 text-[0.7rem] font-medium text-[#4A5568] [font-family:'Geist_Mono',monospace]"
          aria-hidden="true"
        >
          <CalendarClock size={12} strokeWidth={2.25} />
          schedule
        </span>
      </header>

      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 rounded-[12px] border border-dashed border-slate-200 bg-slate-50/40 px-4 py-10 text-center">
          <p className="m-0 text-[0.95rem] font-semibold text-[#0F1419]">Nothing scheduled.</p>
          <p className="m-0 text-[0.85rem] text-[#4A5568]">
            No approved leave coming up.
          </p>
        </div>
      ) : (
        <ol className="m-0 flex flex-col gap-3 p-0">
          {items.map((lv) => {
            const name = lv.employee?.profile?.full_name ?? 'Unnamed'
            return (
              <li
                key={lv.id}
                className="flex items-start gap-3 rounded-[12px] border border-slate-200 bg-white p-3 transition-colors hover:bg-slate-50/60"
              >
                <span
                  className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0F1419]/[0.06] text-[0.7rem] font-semibold text-[#0F1419] [font-family:'Geist_Mono',monospace]"
                  aria-hidden="true"
                >
                  {initials(name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="m-0 truncate text-[0.9rem] font-semibold text-[#0F1419]">
                    {name}
                  </p>
                  <p className="m-0 mt-1 flex flex-wrap items-center gap-2 text-[0.78rem] text-[#4A5568]">
                    <span className="[font-family:'Geist_Mono',monospace]">
                      {formatRange(lv.start_date, lv.end_date)}
                    </span>
                    <StatusBadge value={lv.leave_type} />
                  </p>
                </div>
                <span className="shrink-0 rounded-[6px] bg-[#0F1419]/[0.04] px-2 py-1 text-[0.7rem] font-semibold text-[#0F1419] [font-family:'Geist_Mono',monospace]">
                  {daysUntil(lv.start_date)}
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </motion.section>
  )
}

export default UpcomingLeaveList
