import { useEffect, useMemo, useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { getEmployeeStatus } from '../../services/dashboardService.js'
import ChartCard from './ChartCard.jsx'
import ChartTooltip from './ChartTooltip.jsx'

/**
 * EmployeeStatusChart — donut showing the split between Active / On Leave /
 * Probation / Inactive. The center slot displays the total so the visual
 * answers "how many people total?" before "how are they split?".
 *
 * Data source: pass `data` to drive it (Reports), or omit it to self-fetch
 * the dashboard mock so the home grid keeps working untouched.
 */
function EmployeeStatusChart({ delay = 0, data: dataProp }) {
  const controlled = dataProp !== undefined
  const [fetched, setFetched] = useState([])

  useEffect(() => {
    if (controlled) return
    let alive = true
    getEmployeeStatus().then((d) => alive && setFetched(d))
    return () => {
      alive = false
    }
  }, [controlled])

  const data = controlled ? dataProp : fetched
  const total = useMemo(() => data.reduce((s, d) => s + d.value, 0), [data])

  return (
    <ChartCard
      title="Employee status"
      subtitle="Distribution across the workforce"
      delay={delay}
    >
      <div className="relative h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              content={
                <ChartTooltip
                  valueFormatter={(v) => `${v} (${total ? Math.round((v / total) * 100) : 0}%)`}
                />
              }
            />
            <Pie
              data={data}
              dataKey="value"
              nameKey="status"
              innerRadius="62%"
              outerRadius="92%"
              paddingAngle={2}
              stroke="none"
              isAnimationActive
              animationDuration={900}
            >
              {data.map((entry) => (
                <Cell key={entry.status} fill={entry.tone} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center label — absolutely positioned over the donut hole. The
            ResponsiveContainer is `relative` via its parent, which lets us
            anchor this without doing manual SVG <text> placement. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[1.75rem] font-bold leading-none text-[#0F1419] [font-family:'Geist',sans-serif]">
            {total}
          </span>
          <span className="mt-1 text-[0.65rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
            Total
          </span>
        </div>
      </div>

      {/* Legend rendered as DOM so we can style swatches + percentages
          consistently with the rest of the dashboard's typography. */}
      <ul className="m-0 grid grid-cols-2 gap-2 p-0">
        {data.map((d) => (
          <li key={d.status} className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ background: d.tone }}
              aria-hidden="true"
            />
            <span className="text-[0.78rem] text-[#4A5568]">{d.status}</span>
            <span className="ml-auto text-[0.78rem] font-semibold text-[#0F1419] [font-family:'Geist_Mono',monospace]">
              {total ? Math.round((d.value / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </ChartCard>
  )
}

export default EmployeeStatusChart
