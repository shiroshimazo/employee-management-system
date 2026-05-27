import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  getSession,
  onAuthStateChange,
  signOut as signOutService,
} from '../services/auth.service.js'
import { getProfile } from '../services/profile.service.js'
import { AuthContext } from './AuthContext.js'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const isMountedRef = useRef(true)

  const loadProfile = useCallback(async (userId) => {
    if (!userId) return null
    const { data, error } = await getProfile(userId)
    if (error) {
      // Don't crash the app — log and surface a null profile so the UI can react.
      console.error('Failed to load profile:', error.message)
      return null
    }
    return data
  }, [])

  useEffect(() => {
    isMountedRef.current = true

    async function bootstrap() {
      const { data } = await getSession()
      if (!isMountedRef.current) return

      const initialSession = data.session ?? null
      setSession(initialSession)

      if (initialSession?.user) {
        const initialProfile = await loadProfile(initialSession.user.id)
        if (!isMountedRef.current) return
        setProfile(initialProfile)
      }

      setLoading(false)
    }

    bootstrap()

    const { data: subscription } = onAuthStateChange(async (_event, nextSession) => {
      if (!isMountedRef.current) return

      setSession(nextSession ?? null)

      if (nextSession?.user) {
        const nextProfile = await loadProfile(nextSession.user.id)
        if (!isMountedRef.current) return
        setProfile(nextProfile)
      } else {
        setProfile(null)
      }

      setLoading(false)
    })

    return () => {
      isMountedRef.current = false
      subscription?.subscription?.unsubscribe()
    }
  }, [loadProfile])

  const refreshProfile = useCallback(async () => {
    if (!session?.user) return
    const next = await loadProfile(session.user.id)
    if (isMountedRef.current) setProfile(next)
  }, [session, loadProfile])

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      signOut: signOutService,
      refreshProfile,
    }),
    [session, profile, loading, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
