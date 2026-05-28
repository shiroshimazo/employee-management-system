import { useEffect, useState } from 'react'
import {
  Area,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getEmployeeGrowth } from '../../services/dashboardService.js'
import ChartCard from './ChartCard.jsx'
import ChartTooltip from './ChartTooltip.jsx'

/**
 * EmployeeGrowthChart — line chart of total headcount per month.
 *
 * Recharts wraps a `LineChart` inside a `ResponsiveContainer` so the SVG
 * adapts to the parent card. We layer a faint Area underneath the line for
 * the "filled trend" feel without overpowering the stroke.
 */
function EmployeeGrowthChart({ delay = 0 }) {
  const [data, setData] = useState([])

  useEffect(() => {
    let alive = true
    getEmployeeGrowth().then((d) => alive && setData(d))
    return () => {
      alive = false
    }
  }, [])

  return (
    <ChartCard
      title="Monthly employee growth"
      subtitle="Total headcount, last 12 months"
      delay={delay}
    >
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
            <defs>
              <linearGradient id="growthFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#2C5EF5" stopOpacity={0.18} />
                <stop offset="100%" stopColor="#2C5EF5" stopOpacity={0} />
              </linearGradient>
            </defs>
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
              cursor={{ stroke: '#2C5EF5', strokeOpacity: 0.25, strokeDasharray: '3 3' }}
              content={
                <ChartTooltip
                  valueFormatter={(v) => `${v} emp`}
                />
              }
            />
            <Area
              type="monotone"
              dataKey="total"
              name="Total"
              stroke="none"
              fill="url(#growthFill)"
              isAnimationActive
              animationDuration={900}
            />
            <Line
              type="monotone"
              dataKey="total"
              name="Total"
              stroke="#2C5EF5"
              strokeWidth={2}
              dot={{ r: 3, stroke: '#2C5EF5', strokeWidth: 2, fill: '#FFFFFF' }}
              activeDot={{ r: 5, stroke: '#FFFFFF', strokeWidth: 2, fill: '#2C5EF5' }}
              isAnimationActive
              animationDuration={1100}
              animationEasing="ease-out"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}

export default EmployeeGrowthChart
