import { DollarSign } from 'lucide-react'
import PayrollLayout from '../../../layouts/PayrollLayout.jsx'

function SalaryManagement() {
  return (
    <PayrollLayout>
      <header className="mb-6">
        <p className="m-0 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
          Compensation
        </p>
        <h1 className="m-0 mt-2 text-[2rem] font-bold leading-[1.1] tracking-[-0.01em] text-[#0F1419] max-[600px]:text-[1.6rem]">
          Salary management
        </h1>
        <p className="mb-0 mt-2 max-w-[58ch] text-[0.95rem] leading-snug text-[#4A5568]">
          Review employee salary coverage and prepare salary records for payroll.
        </p>
      </header>

      <section className="rounded-[16px] border border-slate-200 bg-white p-6 shadow-[0_8px_24px_rgba(15,20,25,0.04)]">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[10px] bg-[#2C5EF5]/10 text-[#2C5EF5]" aria-hidden="true">
            <DollarSign size={18} strokeWidth={2.25} />
          </span>
          <div className="min-w-0">
            <p className="m-0 text-[0.95rem] font-semibold text-[#0F1419]">
              Salary Management is connected.
            </p>
            <p className="m-0 mt-1 text-[0.85rem] leading-snug text-[#4A5568]">
              The next todo will add payroll-safe salary data loading for this page.
            </p>
          </div>
        </div>
      </section>
    </PayrollLayout>
  )
}

export default SalaryManagement
