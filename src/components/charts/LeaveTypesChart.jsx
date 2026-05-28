import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getLeaveTypes } from '../../services/dashboardService.js'
import ChartCard from './ChartCard.jsx'
import ChartTooltip from './ChartTooltip.jsx'

// Series config in one place so the legend, tooltip, and bar list all read
// from the same source. Adding a new leave type is a one-line change.
const SERIES = [
  { key: 'sick', label: 'Sick', color: '#F59E0B' },
  { key: 'vacation', label: 'Vacation', color: '#2C5EF5' },
  { key: 'personal', label: 'Personal', color: '#14B8A6' },
  { key: 'bereavement', label: 'Bereavement', color: '#94A3B8' },
]

/**
 * LeaveTypesChart — stacked bar chart of leave usage by type per month.
 *
 * Each series stacks on the same `stackId` so months show total leave with
 * the breakdown visible inside. Top corners on the topmost series get a
 * radius so the stack reads as one rounded column rather than four bricks.
 */
function LeaveTypesChart({ delay = 0 }) {
  const [data, setData] = useState([])

  useEffect(() => {
    let alive = true
    getLeaveTypes().then((d) => alive && setData(d))
    return () => {
      alive = false
    }
  }, [])

  return (
    <ChartCard
      title="Leave types"
      subtitle="Days taken by leave type · last 6 months"
      delay={delay}
    >
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
            <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="month"
              stroke="#94A3B8"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fontFamily: 'Geist Mono, monospace' }}
            />
            <YAxis
              stroke="#94A3B8"
              tickLine={false}
              axisLine={false}
              width={36}
              tick={{ fontSize: 11, fontFamily: 'Geist Mono, monospace' }}
            />
            <Tooltip
              cursor={{ fill: '#F1F5F9' }}
              content={<ChartTooltip valueFormatter={(v) => `${v} days`} />}
            />
            {SERIES.map((s, i) => {
              const isTop = i === SERIES.length - 1
              return (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={s.label}
                  stackId="leave"
                  fill={s.color}
                  // Round only the topmost series so the stack appears
                  // as one capped column.
                  radius={isTop ? [6, 6, 0, 0] : [0, 0, 0, 0]}
                  isAnimationActive
                  animationDuration={900}
                />
              )
            })}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <ul className="m-0 flex flex-wrap items-center gap-4 p-0">
        {SERIES.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: s.color }}
              aria-hidden="true"
            />
            <span className="text-[0.78rem] text-[#4A5568]">{s.label}</span>
          </li>
        ))}
      </ul>
    </ChartCard>
  )
}

export default LeaveTypesChart
