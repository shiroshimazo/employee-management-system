import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '../hooks/useAuth.js'
import Sidebar from '../components/common/Sidebar/Sidebar.jsx'
import { fadeDown } from '../lib/motion.js'

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
  const { user, loading } = useAuth()

  useEffect(() => {
    if (!loading && !user) {
      window.location.assign('/login')
    }
  }, [loading, user])

  if (loading || !user) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#F1F3F5] [font-family:'Geist',sans-serif]">
        <p className="text-[0.95rem] text-[#4A5568]">Loading…</p>
      </main>
    )
  }

  const activePath = window.location.pathname.toLowerCase()

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
