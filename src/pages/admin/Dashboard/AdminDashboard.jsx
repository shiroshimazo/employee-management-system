import { Building2, Clock4, TrendingUp, Users } from 'lucide-react'
import { motion } from 'framer-motion'
import AdminLayout from '../../../layouts/AdminLayout.jsx'
import StatCard from '../../../components/common/StatCard.jsx'
import { useAuth } from '../../../hooks/useAuth.js'

// Mock KPI data — replaced with real Supabase queries once the employees /
// departments / leave_requests tables exist. Kept local so the page can be
// reasoned about without chasing imports.
const KPIS = [
  {
    label: 'Total Employees',
    value: '248',
    icon: Users,
    delta: { value: '+12', direction: 'up', period: 'vs last month' },
  },
  {
    label: 'Active Departments',
    value: '14',
    icon: Building2,
    delta: { value: '0', direction: 'flat', period: 'no change' },
  },
  {
    label: 'Pending Leave Requests',
    value: '7',
    icon: Clock4,
    accent: 'neutral',
    delta: { value: '−3', direction: 'down', period: 'vs last week' },
  },
  {
    label: 'New Hires This Month',
    value: '5',
    icon: TrendingUp,
    delta: { value: '+2', direction: 'up', period: 'vs last month' },
  },
]

function AdminDashboard() {
  const { user } = useAuth()
  const greetingName =
    user?.user_metadata?.full_name?.split(' ')[0] ??
    user?.email?.split('@')[0] ??
    'there'

  return (
    <AdminLayout>
      {/* Page header */}
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="m-0 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
            Dashboard
          </p>
          <h1 className="m-0 mt-2 text-[2.25rem] font-bold leading-[1.1] tracking-[-0.01em] text-[#0F1419] max-[600px]:text-[1.75rem]">
            Welcome back, {greetingName}.
          </h1>
          <p className="mb-0 mt-2 text-[0.95rem] leading-snug text-[#4A5568]">
            Here's what's happening across your organization today.
          </p>
        </div>

        <span
          className="inline-flex items-center gap-2 rounded-[10px] bg-white px-3 py-2 text-[0.75rem] font-medium text-[#4A5568] shadow-[0_4px_12px_rgba(15,20,25,0.04)] [font-family:'Geist_Mono',monospace]"
          aria-label="Last updated"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
          Live · updated just now
        </span>
      </header>

      {/* KPI grid */}
      <section aria-label="Key performance indicators">
        <motion.ul
          // Stagger child fade-ins so the row reads left-to-right rather than
          // popping in all at once. Variants are local; this is the only
          // place we need them for now.
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
          }}
          className="grid list-none grid-cols-4 gap-4 p-0 max-[1100px]:grid-cols-2 max-[600px]:grid-cols-1"
        >
          {KPIS.map((kpi) => (
            <motion.li
              key={kpi.label}
              variants={{
                hidden: { opacity: 0, y: 12 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
                },
              }}
            >
              <StatCard {...kpi} />
            </motion.li>
          ))}
        </motion.ul>
      </section>

      {/* Placeholder zones for future iterations — kept visible so the layout
          composition reads correctly even before charts/feeds land. */}
      <section className="mt-8 grid grid-cols-3 gap-4 max-[1100px]:grid-cols-1">
        <div className="col-span-2 flex min-h-[280px] flex-col gap-3 rounded-[16px] border border-dashed border-slate-300 bg-white/60 p-6 max-[1100px]:col-span-1">
          <p className="m-0 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
            Headcount trend
          </p>
          <p className="m-0 text-[0.95rem] text-[#4A5568]">
            Coming soon — monthly headcount line chart.
          </p>
        </div>

        <div className="flex min-h-[280px] flex-col gap-3 rounded-[16px] border border-dashed border-slate-300 bg-white/60 p-6">
          <p className="m-0 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
            Recent activity
          </p>
          <p className="m-0 text-[0.95rem] text-[#4A5568]">
            Coming soon — audit log feed.
          </p>
        </div>
      </section>
    </AdminLayout>
  )
}

export default AdminDashboard
