import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  CalendarClock,
  GraduationCap,
  Sparkles,
  UserPlus,
} from 'lucide-react'
import { getUpcomingEvents } from '../../services/dashboardService.js'

// Event kind → icon + tone. Keeps the timeline visually scannable and
// reuses the same 4-color tonal vocabulary as the rest of the dashboard.
const KIND_META = {
  meeting: { Icon: Sparkles, tone: 'text-blue-700 bg-blue-50' },
  cycle: { Icon: GraduationCap, tone: 'text-teal-700 bg-teal-50' },
  onboarding: { Icon: UserPlus, tone: 'text-emerald-700 bg-emerald-50' },
  deadline: { Icon: AlertTriangle, tone: 'text-amber-700 bg-amber-50' },
}

function formatWhen(iso) {
  const d = new Date(iso)
  const date = d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return { date, time }
}

function daysUntil(iso) {
  const ms = new Date(iso).getTime() - Date.now()
  const d = Math.ceil(ms / (1000 * 60 * 60 * 24))
  if (d <= 0) return 'Today'
  if (d === 1) return 'Tomorrow'
  return `In ${d} days`
}

/**
 * UpcomingEventsList — calendar-flavored list of HR events on the horizon.
 *
 * Each row pairs a short relative cue ("Tomorrow", "In 3 days") with the
 * absolute date so admins can plan without needing to compute it
 * themselves. Sorted ascending so the soonest event is always on top.
 */
function UpcomingEventsList({ delay = 0 }) {
  const [items, setItems] = useState([])

  useEffect(() => {
    let alive = true
    getUpcomingEvents().then((d) => {
      if (!alive) return
      const sorted = [...d].sort((a, b) => new Date(a.when) - new Date(b.when))
      setItems(sorted)
    })
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
      aria-label="Upcoming HR events"
    >
      <header className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
            Upcoming HR events
          </p>
          <p className="m-0 mt-1 text-[0.85rem] text-[#4A5568]">
            Next {items.length} on the calendar
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

      <ol className="m-0 flex flex-col gap-3 p-0">
        {items.map((ev) => {
          const meta = KIND_META[ev.kind] ?? KIND_META.meeting
          const Icon = meta.Icon
          const { date, time } = formatWhen(ev.when)
          return (
            <li
              key={ev.id}
              className="flex items-start gap-3 rounded-[12px] border border-slate-200 bg-white p-3 transition-colors hover:bg-slate-50/60"
            >
              <span
                className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${meta.tone}`}
                aria-hidden="true"
              >
                <Icon size={16} strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="m-0 truncate text-[0.9rem] font-semibold text-[#0F1419]">
                  {ev.title}
                </p>
                <p className="m-0 mt-0.5 truncate text-[0.78rem] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
                  {date} · {time} · {ev.owner}
                </p>
              </div>
              <span className="shrink-0 rounded-[6px] bg-[#0F1419]/[0.04] px-2 py-1 text-[0.7rem] font-semibold text-[#0F1419] [font-family:'Geist_Mono',monospace]">
                {daysUntil(ev.when)}
              </span>
            </li>
          )
        })}
      </ol>
    </motion.section>
  )
}

export default UpcomingEventsList
