import { ArrowDownRight, ArrowUpRight } from 'lucide-react'

/**
 * StatCard — KPI tile for the dashboard home grid.
 *
 * Props:
 *   - label:      short uppercase descriptor (rendered in Geist Mono)
 *   - value:      the headline number/string (rendered in display weight)
 *   - delta:      optional { value: '+12', direction: 'up' | 'down' | 'flat', period: 'vs last month' }
 *   - icon:       optional lucide icon component for the corner accent
 *   - accent:     'brand' (default) | 'neutral' — controls the icon chip tint
 */
function StatCard({ label, value, delta, icon: Icon, accent = 'brand' }) {
  const direction = delta?.direction ?? 'flat'

  const deltaTone =
    direction === 'up'
      ? 'text-emerald-700 bg-emerald-50'
      : direction === 'down'
        ? 'text-[#B42318] bg-red-50'
        : 'text-[#4A5568] bg-[#F1F3F5]'

  const DeltaIcon =
    direction === 'up'
      ? ArrowUpRight
      : direction === 'down'
        ? ArrowDownRight
        : null

  const iconChip =
    accent === 'brand'
      ? 'bg-[#2C5EF5]/10 text-[#2C5EF5]'
      : 'bg-[#F1F3F5] text-[#4A5568]'

  return (
    <article className="flex flex-col gap-4 rounded-[16px] border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,20,25,0.04)] transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(15,20,25,0.08)]">
      <header className="flex items-start justify-between gap-3">
        <p className="m-0 text-[0.7rem] font-medium uppercase leading-tight tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
          {label}
        </p>
        {Icon ? (
          <span
            className={`flex h-9 w-9 flex-none items-center justify-center rounded-[10px] ${iconChip}`}
            aria-hidden="true"
          >
            <Icon size={18} strokeWidth={2} />
          </span>
        ) : null}
      </header>

      <p className="m-0 text-[2.25rem] font-bold leading-none tracking-[-0.01em] text-[#0F1419]">
        {value}
      </p>

      {delta ? (
        <footer className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-[6px] px-2 py-1 text-[0.75rem] font-semibold ${deltaTone}`}
          >
            {DeltaIcon ? (
              <DeltaIcon size={12} strokeWidth={2.5} aria-hidden="true" />
            ) : null}
            {delta.value}
          </span>
          {delta.period ? (
            <span className="text-[0.75rem] leading-tight text-[#4A5568]">
              {delta.period}
            </span>
          ) : null}
        </footer>
      ) : null}
    </article>
  )
}

export default StatCard
