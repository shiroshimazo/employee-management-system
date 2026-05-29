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

    const { data: subscription } = onAuthStateChange((event, nextSession) => {
      // CRITICAL: never `await` inside this callback. supabase-js holds an
      // internal auth lock while the listener runs, so any awaited DB call
      // here will deadlock other auth operations (e.g. updateUser during
      // password reset). Fire profile loading as a side effect instead.
      if (!isMountedRef.current) return

      setSession(nextSession ?? null)

      // During PASSWORD_RECOVERY the user is mid-flow and about to be signed
      // out after they pick a new password — there's no useful profile to
      // load, and trying to load one would just race the recovery state.
      if (event === 'PASSWORD_RECOVERY') {
        setLoading(false)
        return
      }

      if (nextSession?.user) {
        // Keep `loading` true until the profile resolves. App.jsx routes by
        // role, so flipping loading=false while role is still null would flash
        // a 403 on admin/team pages before the profile lands. We fire the load
        // as a side effect (never `await` here — see the lock note above) and
        // only drop `loading` once it settles, success or failure.
        loadProfile(nextSession.user.id)
          .then((nextProfile) => {
            if (isMountedRef.current) setProfile(nextProfile)
          })
          .finally(() => {
            if (isMountedRef.current) setLoading(false)
          })
      } else {
        setProfile(null)
        setLoading(false)
      }
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
