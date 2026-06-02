import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '../hooks/useAuth.js'
import Sidebar from '../components/common/Sidebar/Sidebar.jsx'
import { LoadingState } from '../components/common/LoadingBars.jsx'
import { fadeDown } from '../lib/motion.js'
import { homePathForRole } from '../utils/roleUtils.js'

/**
 * AdminLayout — shell for every page under /admin/*.
 *
 * Renders the persistent Sidebar on the left and a scrollable content area on
 * the right. Children are wrapped in a fade-down so route transitions match
 * the auth pages' visual language.
 *
 * Auth gate: if there's no user, bounce to /login. The auth provider already
 * handles the loading flicker, so we trust `loading` to gate this.
 */
function AdminLayout({ children }) {
  const { user, profile, loading } = useAuth()

  useEffect(() => {
    if (!loading && !user) {
      window.location.assign('/login')
    }
  }, [loading, user])

  if (loading || !user) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#F1F3F5] [font-family:'Geist',sans-serif]">
        <LoadingState
          label="Loading"
          className="text-[0.95rem] text-[#4A5568]"
          barsClassName="h-5 w-8"
        />
      </main>
    )
  }

  // After login, LoginPage lands the user on bare '/', where App.jsx renders
  // their role's home without changing the URL. The sidebar highlights by
  // matching the URL against each item's href (Dashboard is an exact match),
  // so '/' would match nothing and leave no item active. Resolve '/' to the
  // role's actual home path so the Dashboard item lights up like any other.
  const rawPath = window.location.pathname.toLowerCase()
  const activePath = rawPath === '/' ? homePathForRole(profile?.role) : rawPath

  return (
    <div className="flex min-h-dvh bg-[#F1F3F5] [font-family:'Geist',sans-serif] text-[#0F1419]">
      <Sidebar activePath={activePath} />

      <motion.main
        {...fadeDown}
        className="flex-1 overflow-x-hidden px-8 py-8 max-[900px]:px-4"
      >
        {children}
      </motion.main>
    </div>
  )
}

export default AdminLayout
