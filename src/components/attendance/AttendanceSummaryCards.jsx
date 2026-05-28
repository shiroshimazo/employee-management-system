import { motion } from 'framer-motion'
import { CheckCircle2, Clock4, MinusCircle, UserMinus, Users } from 'lucide-react'

/**
 * AttendanceSummaryCards — KPI row for "today" rollups.
 *
 * Designed to be reused on Admin/HR and Manager pages — admin gets the org-
 * wide numbers, manager gets the team-scoped numbers (RLS handles the
 * scoping in the service). The component itself just renders whatever the
 * page hands it.
 *
 * Five cards: Total · Present · Late · On Leave · Absent. The order tracks
 * how an HR manager scans the day: total first, then "all good" buckets,
 * then attention-grabbing buckets at the end.
 */

const FIELDS = [
  { key: 'total', label: 'Active employees', icon: Users, tone: 'bg-slate-100 text-slate-700' },
  { key: 'present', label: 'Present', icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-700' },
  { key: 'late', label: 'Late', icon: Clock4, tone: 'bg-amber-50 text-amber-700' },
  { key: 'leave', label: 'On leave', icon: MinusCircle, tone: 'bg-blue-50 text-blue-700' },
  { key: 'absent', label: 'Absent', icon: UserMinus, tone: 'bg-red-50 text-red-700' },
]

function AttendanceSummaryCards({ summary, loading = false }) {
  return (
    <motion.section
      aria-label="Attendance summary"
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } },
      }}
      className="grid grid-cols-5 gap-3 max-[1100px]:grid-cols-3 max-[600px]:grid-cols-1"
    >
      {FIELDS.map((f) => {
        const Icon = f.icon
        const value = summary?.[f.key]
        return (
          <motion.div
            key={f.key}
            variants={{
              hidden: { opacity: 0, y: 8 },
              visible: {
                opacity: 1,
                y: 0,
                transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
              },
            }}
            className="flex items-start justify-between gap-3 rounded-[14px] border border-slate-200 bg-white p-4 shadow-[0_4px_12px_rgba(15,20,25,0.03)]"
          >
            <div className="min-w-0">
              <p className="m-0 text-[0.65rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
                {f.label}
              </p>
              <p className="m-0 mt-1 text-[1.5rem] font-bold leading-none text-[#0F1419] [font-family:'Geist',sans-serif]">
                {loading ? '—' : (value ?? 0)}
              </p>
            </div>
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${f.tone}`}
              aria-hidden="true"
            >
              <Icon size={16} strokeWidth={2} />
            </span>
          </motion.div>
        )
      })}
    </motion.section>
  )
}

export default AttendanceSummaryCards
