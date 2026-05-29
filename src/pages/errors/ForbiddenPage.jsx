import { motion } from 'framer-motion'
import { ShieldAlert } from 'lucide-react'
import { fadeDown } from '../../lib/motion.js'
import { useAuth } from '../../hooks/useAuth.js'
import { homePathForRole } from '../../utils/roleUtils.js'

/**
 * ForbiddenPage — 403 shown when a signed-in user hits a route their role
 * can't reach (e.g. an employee opening /admin). The "Go to my home" link
 * routes them to the right workspace for their role rather than dead-ending.
 */
function ForbiddenPage() {
  const { profile } = useAuth()
  const home = homePathForRole(profile?.role)

  return (
    <main className="flex min-h-dvh items-center justify-center bg-white px-6 py-8 [font-family:'Geist',sans-serif]">
      <motion.div
        {...fadeDown}
        className="w-full max-w-[420px] rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-[0_24px_70px_rgba(15,20,25,0.08)] max-[420px]:p-5"
      >
        <span
          className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600"
          aria-hidden="true"
        >
          <ShieldAlert size={26} strokeWidth={2} />
        </span>
        <p className="m-0 text-[0.7rem] font-medium uppercase tracking-[0.14em] text-[#94A3B8] [font-family:'Geist_Mono',monospace]">
          Error 403
        </p>
        <h1 className="m-0 mt-2 text-[1.75rem] font-bold leading-[1.1] text-[#0F1419]">
          Access denied
        </h1>
        <p className="mb-0 mt-3 text-[0.95rem] leading-[1.5] text-[#4A5568]">
          You don’t have permission to view this page. If you think this is a
          mistake, contact an administrator.
        </p>
        <a
          href={home}
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-[10px] bg-[#2C5EF5] px-4 text-[0.9rem] font-semibold text-white no-underline transition-colors hover:bg-[#1F4CE0]"
        >
          Go to my home
        </a>
      </motion.div>
    </main>
  )
}

export default ForbiddenPage
