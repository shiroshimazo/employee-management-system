import { useEffect, useState } from 'react'
import { CheckCircle2, Eye, EyeOff, Lock, ShieldAlert } from 'lucide-react'
import { motion } from 'framer-motion'
import { LoadingButtonLabel, LoadingState } from '../../components/common/LoadingBars.jsx'
import { supabase } from '../../lib/supabase.js'
import { updatePassword } from '../../services/auth.service.js'
import { fadeDown } from '../../lib/motion.js'

const MIN_PASSWORD_LENGTH = 8

function ResetPasswordPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [formValues, setFormValues] = useState({
    password: '',
    confirmPassword: '',
  })
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [toastVisible, setToastVisible] = useState(false)

  // Tri-state link check: 'checking' → 'ready' (recovery session present)
  // or 'invalid' (no recovery context detected).
  const [linkStatus, setLinkStatus] = useState('checking')
  const [linkError, setLinkError] = useState('')

  useEffect(() => {
    let isMounted = true

    // Supabase puts auth errors directly in the URL when a link is expired or
    // already used. Catch those first so we can show a real message instead of
    // letting the page sit on "verifying" until the timeout.
    const hashParams = new URLSearchParams(
      window.location.hash.replace(/^#/, ''),
    )
    const queryParams = new URLSearchParams(window.location.search)
    const urlError =
      hashParams.get('error_description') ||
      queryParams.get('error_description') ||
      hashParams.get('error') ||
      queryParams.get('error')

    if (urlError) {
      setLinkError(decodeURIComponent(urlError).replace(/\+/g, ' '))
      setLinkStatus('invalid')
      return undefined
    }

    // Implicit recovery flow: pull the tokens out of the hash and explicitly
    // hand them to supabase.auth.setSession. We don't trust `detectSessionInUrl`
    // alone — it races React mounting and on a refresh the auto-parse may have
    // already silently failed, leaving updateUser() with no session to use
    // (which is what produces the "request timed out" we hit before).
    const hashType = hashParams.get('type')
    const hashAccessToken = hashParams.get('access_token')
    const hashRefreshToken = hashParams.get('refresh_token')

    if (hashType === 'recovery' && hashAccessToken && hashRefreshToken) {
      ;(async () => {
        const { error } = await supabase.auth.setSession({
          access_token: hashAccessToken,
          refresh_token: hashRefreshToken,
        })
        if (!isMounted) return
        if (error) {
          setLinkError(error.message)
          setLinkStatus('invalid')
          return
        }
        // Clear tokens from the URL once the session is safely in storage.
        window.history.replaceState(
          null,
          '',
          window.location.pathname + window.location.search,
        )
        setLinkStatus('ready')
      })()
      return () => {
        isMounted = false
      }
    }

    // PKCE flow: ?code=... in the query string. detectSessionInUrl handles the
    // network exchange; the listener catches the resulting event.
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return
        if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
          setLinkStatus('ready')
        }
      },
    )

    const verifyTimer = window.setTimeout(async () => {
      if (!isMounted) return
      const { data } = await supabase.auth.getSession()
      if (!isMounted) return
      setLinkStatus((current) => {
        if (current === 'ready') return current
        return data.session ? 'ready' : 'invalid'
      })
    }, 2500)

    return () => {
      isMounted = false
      window.clearTimeout(verifyTimer)
      authListener.subscription.unsubscribe()
    }
  }, [])

  const handleChange = (event) => {
    const { name, value } = event.target

    setFormValues((currentValues) => ({
      ...currentValues,
      [name]: value,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitError('')

    if (formValues.password.length < MIN_PASSWORD_LENGTH) {
      setSubmitError(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      )
      return
    }

    if (formValues.password !== formValues.confirmPassword) {
      setSubmitError('Passwords do not match.')
      return
    }

    setIsSubmitting(true)

    try {
      // Race the update against a 10s timeout so a hung network call can't
      // freeze the button forever — surface a real error instead.
      const updatePromise = updatePassword(formValues.password)
      const timeoutPromise = new Promise((_, reject) =>
        window.setTimeout(
          () =>
            reject(new Error('The request timed out. Please try again.')),
          10000,
        ),
      )

      const { error } = await Promise.race([updatePromise, timeoutPromise])

      if (error) {
        setSubmitError(error.message)
        return
      }

      // Best-effort sign-out of the recovery session — fire and forget so a
      // slow signOut can't block the success state.
      supabase.auth.signOut().catch(() => {})

      setSubmitted(true)
    } catch (err) {
      setSubmitError(
        err?.message ?? 'Something went wrong. Please try again.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  // After successful update: animate the toast in, then redirect to /login.
  useEffect(() => {
    if (!submitted) return undefined

    const showTimer = window.setTimeout(() => setToastVisible(true), 20)
    const redirectTimer = window.setTimeout(() => {
      window.location.assign('/login')
    }, 1800)

    return () => {
      window.clearTimeout(showTimer)
      window.clearTimeout(redirectTimer)
    }
  }, [submitted])

  const isFormDisabled = isSubmitting || submitted

  if (linkStatus === 'checking') {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-white px-6 py-8 [font-family:'Geist',sans-serif]">
        <LoadingState
          label="Verifying your reset link"
          className="text-[0.95rem] text-[#4A5568]"
          barsClassName="h-5 w-8"
        />
      </main>
    )
  }

  if (linkStatus === 'invalid') {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-white px-6 py-8 [font-family:'Geist',sans-serif]">
        <motion.div
          {...fadeDown}
          className="w-full max-w-[360px] rounded-2xl border border-slate-200 bg-white p-8 shadow-[0_24px_70px_rgba(15,20,25,0.08)] max-[420px]:p-5"
          role="status"
          aria-live="polite"
        >
          <header className="mb-8 text-center">
            <div className="mb-4 flex justify-center text-[#B42318]">
              <ShieldAlert size={40} strokeWidth={2} aria-hidden="true" />
            </div>
            <h1 className="m-0 text-4xl font-bold leading-[1.05] text-[#0F1419] max-[420px]:text-[2rem]">
              Link expired
            </h1>
            <p className="mb-0 mt-3 text-[0.95rem] font-normal leading-[1.45] text-[#4A5568]">
              {linkError
                ? linkError
                : 'This password reset link is invalid or has expired.'}
              <br />
              Please request a new one.
            </p>
          </header>

          <a
            className="mt-2 flex w-full cursor-pointer items-center justify-center rounded-[10px] border-0 bg-[#2C5EF5] p-3.5 text-[0.95rem] font-semibold tracking-[0.08em] text-white no-underline transition-[background-color,box-shadow,transform] duration-150 hover:bg-[#1F4CE0] hover:shadow-[0_12px_30px_rgba(44,94,245,0.24)] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[#2C5EF5]"
            href="/forgot-password"
          >
            REQUEST NEW LINK
          </a>
        </motion.div>
      </main>
    )
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-white px-6 py-8 [font-family:'Geist',sans-serif]">
      <motion.form
        {...fadeDown}
        className="w-full max-w-[360px] rounded-2xl border border-slate-200 bg-white p-8 shadow-[0_24px_70px_rgba(15,20,25,0.08)] max-[420px]:p-5"
        onSubmit={handleSubmit}
        aria-label="Reset password form"
        aria-busy={isSubmitting}
      >
          <header className="mb-8 text-center">
            <h1 className="m-0 text-4xl font-bold leading-[1.05] text-[#0F1419] max-[420px]:text-[2rem]">
              Set a new password
            </h1>
            <p className="mb-0 mt-3 text-[0.95rem] font-normal leading-[1.45] text-[#4A5568]">
              Choose a strong password you haven't
              <br />
              used before.
            </p>
          </header>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col">
              <label
                className="mb-2 block text-xs font-medium leading-tight text-[#0F1419] [font-family:'Geist_Mono',monospace]"
                htmlFor="password"
              >
                New password
              </label>
              <div className="relative rounded-[6px] border border-transparent bg-[#F1F3F5] transition-[border-color,box-shadow] duration-150 focus-within:border-[#2C5EF5] focus-within:shadow-[0_0_0_3px_rgba(44,94,245,0.15)]">
                <span
                  className="pointer-events-none absolute left-3.5 top-1/2 flex -translate-y-1/2 items-center justify-center text-[#4A5568]"
                  aria-hidden="true"
                >
                  <Lock size={16} strokeWidth={2} />
                </span>
                <input
                  id="password"
                  name="password"
                  className="min-h-11 w-full border-0 bg-transparent px-4 py-3 pl-10 pr-12 text-[0.95rem] text-[#0F1419] outline-none placeholder:text-[#4A5568]"
                  type={showPassword ? 'text' : 'password'}
                  value={formValues.password}
                  onChange={handleChange}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                />
                <div className="absolute right-0 top-1/2 flex -translate-y-1/2 items-center justify-center">
                  <button
                    type="button"
                    className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-[6px] border-0 bg-transparent p-0 text-[#4A5568] transition-colors duration-150 hover:text-[#0F1419] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#2C5EF5]"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((isVisible) => !isVisible)}
                  >
                    {showPassword ? (
                      <EyeOff size={16} strokeWidth={2} aria-hidden="true" />
                    ) : (
                      <Eye size={16} strokeWidth={2} aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col">
              <label
                className="mb-2 block text-xs font-medium leading-tight text-[#0F1419] [font-family:'Geist_Mono',monospace]"
                htmlFor="confirmPassword"
              >
                Confirm new password
              </label>
              <div className="relative rounded-[6px] border border-transparent bg-[#F1F3F5] transition-[border-color,box-shadow] duration-150 focus-within:border-[#2C5EF5] focus-within:shadow-[0_0_0_3px_rgba(44,94,245,0.15)]">
                <span
                  className="pointer-events-none absolute left-3.5 top-1/2 flex -translate-y-1/2 items-center justify-center text-[#4A5568]"
                  aria-hidden="true"
                >
                  <Lock size={16} strokeWidth={2} />
                </span>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  className="min-h-11 w-full border-0 bg-transparent px-4 py-3 pl-10 pr-12 text-[0.95rem] text-[#0F1419] outline-none placeholder:text-[#4A5568]"
                  type={showConfirm ? 'text' : 'password'}
                  value={formValues.confirmPassword}
                  onChange={handleChange}
                  placeholder="Re-enter new password"
                  autoComplete="new-password"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                />
                <div className="absolute right-0 top-1/2 flex -translate-y-1/2 items-center justify-center">
                  <button
                    type="button"
                    className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-[6px] border-0 bg-transparent p-0 text-[#4A5568] transition-colors duration-150 hover:text-[#0F1419] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#2C5EF5]"
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}
                    onClick={() => setShowConfirm((isVisible) => !isVisible)}
                  >
                    {showConfirm ? (
                      <EyeOff size={16} strokeWidth={2} aria-hidden="true" />
                    ) : (
                      <Eye size={16} strokeWidth={2} aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <button
              className="mt-2 w-full cursor-pointer rounded-[10px] border-0 bg-[#2C5EF5] p-3.5 text-[0.95rem] font-semibold tracking-[0.08em] text-white transition-[background-color,box-shadow,transform] duration-150 hover:bg-[#1F4CE0] hover:shadow-[0_12px_30px_rgba(44,94,245,0.24)] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[#2C5EF5] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-[#2C5EF5] disabled:hover:shadow-none"
              type="submit"
              disabled={isFormDisabled}
            >
              {submitted
                ? 'PASSWORD UPDATED'
                : isSubmitting
                  ? <LoadingButtonLabel label="UPDATING" barsClassName="h-4 w-6" />
                  : 'UPDATE PASSWORD'}
            </button>

            {submitError ? (
              <p
                className="mb-0 mt-1 text-center text-xs leading-snug text-[#B42318]"
                role="alert"
              >
                {submitError}
              </p>
            ) : null}
          </div>

          <p className="mb-0 mt-6 text-center text-[0.95rem] leading-[1.4] text-[#4A5568]">
            Remembered it after all?{' '}
            <a
              className="text-[#2C5EF5] no-underline hover:underline"
              href="/login"
            >
              Log in
            </a>
          </p>
        </motion.form>

      {submitted ? (
        <div
          className={`pointer-events-none fixed inset-x-0 top-6 z-50 flex justify-center px-4 transition-[opacity,transform] duration-300 ease-out ${
            toastVisible
              ? 'translate-y-0 opacity-100'
              : '-translate-y-3 opacity-0'
          }`}
          role="status"
          aria-live="polite"
        >
          <div className="pointer-events-auto flex w-full max-w-[420px] items-start gap-3 rounded-xl border border-[#2C5EF5]/20 bg-white p-4 shadow-[0_18px_50px_rgba(15,20,25,0.16)]">
            <span
              className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[#2C5EF5]/10 text-[#2C5EF5]"
              aria-hidden="true"
            >
              <CheckCircle2 size={18} strokeWidth={2.25} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="m-0 text-sm font-semibold leading-tight text-[#0F1419]">
                Password updated
              </p>
              <p className="mb-0 mt-1 text-xs leading-snug text-[#4A5568]">
                Redirecting you to the login page…
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}

export default ResetPasswordPage
