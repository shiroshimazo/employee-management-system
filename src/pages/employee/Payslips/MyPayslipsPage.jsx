import { FileText } from 'lucide-react'
import AdminLayout from '../../../layouts/AdminLayout.jsx'

/**
 * MyPayslipsPage — placeholder.
 *
 * Payslips depend on a payroll module that isn't built yet (the
 * payroll.service.js stub exists but has no schema behind it). This page
 * is a real route so the sidebar link works, with a helpful "coming soon"
 * state instead of a 404. Once payroll lands, replace the body with the
 * real list — the page-level shell already matches the rest of /employee/*.
 */
function MyPayslipsPage() {
  return (
    <AdminLayout>
      <header className="mb-6">
        <p className="m-0 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
          Payroll
        </p>
        <h1 className="m-0 mt-2 text-[2rem] font-bold leading-[1.1] tracking-[-0.01em] text-[#0F1419] max-[600px]:text-[1.6rem]">
          My payslips
        </h1>
        <p className="mb-0 mt-2 text-[0.95rem] leading-snug text-[#4A5568]">
          Download past pay statements and check your latest payroll cycle.
        </p>
      </header>

      <section
        aria-label="Coming soon"
        className="flex flex-col items-center gap-3 rounded-[16px] border border-dashed border-slate-200 bg-white px-6 py-16 text-center shadow-[0_4px_12px_rgba(15,20,25,0.03)]"
      >
        <span
          className="flex h-12 w-12 items-center justify-center rounded-[12px] bg-[#2C5EF5]/10 text-[#2C5EF5]"
          aria-hidden="true"
        >
          <FileText size={20} strokeWidth={2} />
        </span>
        <p className="m-0 text-[1rem] font-semibold text-[#0F1419]">
          Payslips are coming soon.
        </p>
        <p className="m-0 max-w-md text-[0.9rem] leading-snug text-[#4A5568]">
          The payroll module is on the roadmap. Once it ships, your monthly pay
          statements will show up here with PDF downloads and a breakdown of
          earnings, deductions, and taxes.
        </p>
      </section>
    </AdminLayout>
  )
}

export default MyPayslipsPage
