import { motion } from 'framer-motion'

/**
 * ChartCard — shared shell for every dashboard chart.
 *
 * Pulls the visual chrome (border, padding, shadow, header layout, entrance
 * animation) out of each chart so the chart bodies only deal with their own
 * Recharts tree. Pass an `action` node for filter chips, "View all" links,
 * or any controls that belong on the right side of the header.
 */
function ChartCard({ title, subtitle, action, children, delay = 0, className = '' }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
      className={`flex h-full flex-col gap-4 rounded-[16px] border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,20,25,0.04)] ${className}`}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
            {title}
          </p>
          {subtitle ? (
            <p className="m-0 mt-1 text-[0.85rem] leading-snug text-[#4A5568]">
              {subtitle}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </motion.section>
  )
}

export default ChartCard
