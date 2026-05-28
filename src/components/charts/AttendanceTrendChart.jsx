import { useEffect, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getAttendanceTrend } from '../../services/dashboardService.js'
import ChartCard from './ChartCard.jsx'
import ChartTooltip from './ChartTooltip.jsx'

/**
 * AttendanceTrendChart — area chart for the "present this week" rhythm.
 *
 * Two series stacked visually but rendered as separate Areas so we can show
 * present vs absent in the tooltip with their own colors. Stacking would
 * compress the absent line into the bottom — keeping them independent makes
 * weekend dips immediately visible.
 */
function AttendanceTrendChart({ delay = 0 }) {
  const [data, setData] = useState([])

  useEffect(() => {
    let alive = true
    getAttendanceTrend().then((d) => alive && setData(d))
    return () => {
      alive = false
    }
  }, [])

  return (
    <ChartCard
      title="Attendance trend"
      subtitle="Daily present vs absent · this week"
      delay={delay}
    >
      <div className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
            <defs>
              <linearGradient id="presentFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#14B8A6" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#14B8A6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="absentFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#F59E0B" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="day"
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
              cursor={{ stroke: '#94A3B8', strokeOpacity: 0.25, strokeDasharray: '3 3' }}
              content={<ChartTooltip valueFormatter={(v) => `${v} emp`} />}
            />
            <Area
              type="monotone"
              dataKey="present"
              name="Present"
              stroke="#14B8A6"
              strokeWidth={2}
              fill="url(#presentFill)"
              isAnimationActive
              animationDuration={1000}
            />
            <Area
              type="monotone"
              dataKey="absent"
              name="Absent"
              stroke="#F59E0B"
              strokeWidth={2}
              fill="url(#absentFill)"
              isAnimationActive
              animationDuration={1000}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <ul className="m-0 flex flex-wrap items-center gap-4 p-0">
        <li className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#14B8A6]" aria-hidden="true" />
          <span className="text-[0.78rem] text-[#4A5568]">Present</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#F59E0B]" aria-hidden="true" />
          <span className="text-[0.78rem] text-[#4A5568]">Absent</span>
        </li>
      </ul>
    </ChartCard>
  )
}

export default AttendanceTrendChart
