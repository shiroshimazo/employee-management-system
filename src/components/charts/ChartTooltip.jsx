/**
 * ChartTooltip — drop-in custom tooltip for every Recharts chart.
 *
 * Recharts hands us a `payload` array of the series under the cursor. We
 * render them in the same card vocabulary as the rest of the dashboard so
 * tooltips don't break the visual rhythm of the page.
 */
function ChartTooltip({ active, payload, label, valueFormatter, labelFormatter }) {
  if (!active || !payload || payload.length === 0) return null

  const renderValue = valueFormatter ?? ((v) => v)
  const renderLabel = labelFormatter ?? ((l) => l)

  return (
    <div className="rounded-[10px] border border-slate-200 bg-white px-3 py-2 shadow-[0_8px_24px_rgba(15,20,25,0.08)]">
      {label !== undefined ? (
        <p className="m-0 text-[0.65rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
          {renderLabel(label)}
        </p>
      ) : null}
      <ul className="m-0 mt-1 list-none p-0">
        {payload.map((entry, i) => (
          <li key={i} className="flex items-center gap-2 py-0.5">
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-sm"
              style={{ background: entry.color || entry.payload?.tone || '#2C5EF5' }}
              aria-hidden="true"
            />
            <span className="text-[0.78rem] text-[#4A5568]">
              {entry.name}
            </span>
            <span className="ml-auto text-[0.85rem] font-semibold text-[#0F1419] [font-family:'Geist_Mono',monospace]">
              {renderValue(entry.value, entry)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default ChartTooltip
