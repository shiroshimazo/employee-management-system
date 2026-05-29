import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getDepartmentHeadcount } from '../../services/dashboardService.js'
import ChartCard from './ChartCard.jsx'
import ChartTooltip from './ChartTooltip.jsx'

/**
 * DepartmentHeadcountChart — horizontal bar chart of staff per department.
 *
 * Horizontal layout because department labels are long and read more cleanly
 * along the y-axis. The bar with the largest value is tinted in brand blue;
 * the rest are tonal so the eye lands on the leader without losing context.
 *
 * Data source: pass `data` to drive it (Reports), or omit it to self-fetch
 * the dashboard mock so the home grid keeps working untouched. Either way the
 * chart sorts descending itself, so callers don't have to.
 */
function DepartmentHeadcountChart({ delay = 0, data: dataProp }) {
  const controlled = dataProp !== undefined
  const [fetched, setFetched] = useState([])

  useEffect(() => {
    if (controlled) return
    let alive = true
    getDepartmentHeadcount().then((d) => alive && setFetched(d))
    return () => {
      alive = false
    }
  }, [controlled])

  // Sort descending so the largest department reads first when scanning.
  const data = useMemo(() => {
    const source = controlled ? dataProp : fetched
    return [...(source ?? [])].sort((a, b) => b.headcount - a.headcount)
  }, [controlled, dataProp, fetched])

  const max = data.length > 0 ? Math.max(...data.map((d) => d.headcount)) : 0

  return (
    <ChartCard
      title="Department headcount"
      subtitle="Active employees by department"
      delay={delay}
    >
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 16, bottom: 0, left: 8 }}
          >
            <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" horizontal={false} />
            <XAxis
              type="number"
              stroke="#94A3B8"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fontFamily: 'Geist Mono, monospace' }}
            />
            <YAxis
              type="category"
              dataKey="department"
              stroke="#4A5568"
              tickLine={false}
              axisLine={false}
              width={120}
              tick={{ fontSize: 12, fontFamily: 'Geist, sans-serif' }}
            />
            <Tooltip
              cursor={{ fill: '#F1F5F9' }}
              content={<ChartTooltip valueFormatter={(v) => `${v} people`} />}
            />
            <Bar
              dataKey="headcount"
              name="Headcount"
              radius={[0, 6, 6, 0]}
              isAnimationActive
              animationDuration={900}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.department}
                  fill={entry.headcount === max ? '#2C5EF5' : '#93B4FB'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}

export default DepartmentHeadcountChart
