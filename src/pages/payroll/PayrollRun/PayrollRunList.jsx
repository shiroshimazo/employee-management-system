import { CalendarDays, CheckCircle2, PlayCircle, ScrollText } from 'lucide-react'
import PayrollLayout from '../../../layouts/PayrollLayout.jsx'

const STEPS = [
  {
    label: 'Run Payroll',
    description: 'Start a payroll cycle for the selected period.',
    icon: PlayCircle,
  },
  {
    label: 'Review',
    description: 'Check salary records before approval.',
    icon: ScrollText,
  },
  {
    label: 'Approval',
    description: 'Finalize the payroll cycle after review.',
    icon: CheckCircle2,
  },
]

function PayrollRunList() {
  return (
    <PayrollLayout>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="m-0 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
            PayrollRun
          </p>
          <h1 className="m-0 mt-2 text-[2rem] font-bold leading-[1.1] tracking-[-0.01em] text-[#0F1419] max-[600px]:text-[1.6rem]">
            Payroll runs
          </h1>
          <p className="mb-0 mt-2 max-w-[62ch] text-[0.95rem] leading-snug text-[#4A5568]">
            Track payroll cycles from setup through review and approval.
          </p>
        </div>

        <span
          className="inline-flex items-center gap-2 rounded-[10px] bg-white px-3 py-2 text-[0.75rem] font-medium text-[#4A5568] shadow-[0_4px_12px_rgba(15,20,25,0.04)] [font-family:'Geist_Mono',monospace]"
          aria-label="Payroll run module status"
        >
          <CalendarDays size={12} strokeWidth={2.25} aria-hidden="true" />
          Setup connected
        </span>
      </header>

      <section className="grid grid-cols-3 gap-4 max-[900px]:grid-cols-1" aria-label="Payroll run workflow">
        {STEPS.map((step, index) => {
          const Icon = step.icon
          return (
            <article
              key={step.label}
              className="rounded-[16px] border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,20,25,0.04)]"
            >
              <header className="flex items-start justify-between gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#2C5EF5]/10 text-[#2C5EF5]" aria-hidden="true">
                  <Icon size={18} strokeWidth={2.25} />
                </span>
                <span className="text-[0.7rem] font-semibold text-[#94A3B8] [font-family:'Geist_Mono',monospace]">
                  0{index + 1}
                </span>
              </header>
              <p className="m-0 mt-4 text-[0.95rem] font-semibold text-[#0F1419]">
                {step.label}
              </p>
              <p className="m-0 mt-1 text-[0.85rem] leading-snug text-[#4A5568]">
                {step.description}
              </p>
            </article>
          )
        })}
      </section>

      <section className="mt-4 rounded-[16px] border border-dashed border-slate-300 bg-white p-6 shadow-[0_8px_24px_rgba(15,20,25,0.04)]">
        <p className="m-0 text-[0.9rem] font-semibold text-[#0F1419]">
          PayrollRun is connected.
        </p>
        <p className="m-0 mt-1 max-w-[62ch] text-[0.85rem] leading-snug text-[#4A5568]">
          The next todo will add payroll run data storage and service functions for creating and listing payroll cycles.
        </p>
      </section>
    </PayrollLayout>
  )
}

export default PayrollRunList
