import { LayoutDashboard } from 'lucide-react'
import PayrollLayout from '../../layouts/PayrollLayout.jsx'

function PayrollModulePlaceholder({ title, description }) {
  return (
    <PayrollLayout>
      <header className="mb-6">
        <p className="m-0 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
          Payroll
        </p>
        <h1 className="m-0 mt-2 text-[2rem] font-bold leading-[1.1] tracking-[-0.01em] text-[#0F1419] max-[600px]:text-[1.6rem]">
          {title}
        </h1>
        <p className="mb-0 mt-2 max-w-[58ch] text-[0.95rem] leading-snug text-[#4A5568]">
          {description}
        </p>
      </header>

      <section className="rounded-[16px] border border-dashed border-slate-300 bg-white p-6 shadow-[0_8px_24px_rgba(15,20,25,0.04)]">
        <p className="m-0 text-[0.9rem] text-[#4A5568]">
          The payroll dashboard is active. This module route is ready for the next payroll workflow.
        </p>
        <a
          href="/payroll"
          className="mt-5 inline-flex items-center gap-2 rounded-[10px] bg-[#2C5EF5] px-3 py-2 text-[0.85rem] font-semibold text-white transition-colors hover:bg-[#1E47C9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2C5EF5]"
        >
          <LayoutDashboard size={16} strokeWidth={2.25} aria-hidden="true" />
          <span>Dashboard</span>
        </a>
      </section>
    </PayrollLayout>
  )
}

export default PayrollModulePlaceholder
