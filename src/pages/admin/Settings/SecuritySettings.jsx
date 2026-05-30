import { useState } from 'react'
import { motion } from 'framer-motion'
import { Eye, EyeOff, KeyRound, Lock, LogOut, ShieldCheck } from 'lucide-react'
import AdminLayout from '../../../layouts/AdminLayout.jsx'
import { useAuth } from '../../../hooks/useAuth.js'
import {
  signInWithPassword,
  signOut,
  updatePassword,
} from '../../../services/auth.service.js'

/**
 * SecuritySettings — the admin's own-account security.
 *
 * Scope note: the browser holds only the Supabase anon key, which can't run
 * org-wide security operations (forcing others' resets, 2FA policy, login
 * audits — those need the service_role key server-side). So this panel is
 * scoped to actions that are genuinely possible from the client and apply to
 * the signed-in account:
 *   - Change password (re-auth verifies the current password first)
 *   - Sign out of all devices (global session revoke)
 */

const MIN_PASSWORD_LENGTH = 8

function fmtDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function SecuritySettings() {
  const { user } = useAuth()

  // Change-password form
  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
  const [show, setShow] = useState({ current: false, next: false, confirm: false })
  const [pwError, setPwError] = useState(null)
  const [pwSuccess, setPwSuccess] = useState(false)
  const [pwSubmitting, setPwSubmitting] = useState(false)

  // Sign-out-all
  const [signingOut, setSigningOut] = useState(false)

  function setField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setPwSuccess(false)
    setPwError(null)
  }

  function toggleShow(field) {
    setShow((prev) => ({ ...prev, [field]: !prev[field] }))
  }

  async function handleChangePassword(e) {
    e.preventDefault()
    setPwError(null)
    setPwSuccess(false)

    if (form.next.length < MIN_PASSWORD_LENGTH) {
      setPwError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
      return
    }
    if (form.next !== form.confirm) {
      setPwError('New passwords do not match.')
      return
    }
    if (form.next === form.current) {
      setPwError('New password must be different from your current password.')
      return
    }

    setPwSubmitting(true)
    try {
      // Verify the current password by re-authenticating. Supabase has no
      // "check password" call, so we sign in again as the same user — on
      // success the session is simply refreshed; on failure the current
      // password was wrong.
      const { error: reauthError } = await signInWithPassword({
        email: user?.email,
        password: form.current,
      })
      if (reauthError) {
        setPwError('Your current password is incorrect.')
        return
      }

      const { error: updateError } = await updatePassword(form.next)
      if (updateError) {
        setPwError(updateError.message)
        return
      }

      setPwSuccess(true)
      setForm({ current: '', next: '', confirm: '' })
    } catch (err) {
      setPwError(err?.message ?? 'Could not update your password.')
    } finally {
      setPwSubmitting(false)
    }
  }

  async function handleSignOutAll() {
    setSigningOut(true)
    try {
      // auth.service#signOut defaults to global scope, which revokes every
      // active session for this user across devices.
      await signOut()
      window.location.assign('/login')
    } catch {
      setSigningOut(false)
    }
  }

  return (
    <AdminLayout>
      <header className="mb-6">
        <p className="m-0 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
          Security
        </p>
        <h1 className="m-0 mt-2 text-[2rem] font-bold leading-[1.1] tracking-[-0.01em] text-[#0F1419] max-[600px]:text-[1.6rem]">
          Account security
        </h1>
        <p className="mb-0 mt-2 text-[0.95rem] leading-snug text-[#4A5568]">
          Manage the password and active sessions for your own account.
        </p>
      </header>

      <section className="grid grid-cols-3 gap-4 max-[900px]:grid-cols-1">
        {/* Change password */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="col-span-2 rounded-[16px] border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,20,25,0.04)] max-[900px]:col-span-1"
          aria-label="Change password"
        >
          <div className="mb-4 flex items-center gap-2.5">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#2C5EF5]/10 text-[#2C5EF5]"
              aria-hidden="true"
            >
              <KeyRound size={18} strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <p className="m-0 text-[0.95rem] font-semibold text-[#0F1419]">Change password</p>
              <p className="m-0 text-[0.8rem] text-[#4A5568]">
                You’ll need your current password to confirm.
              </p>
            </div>
          </div>

          <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
            <PasswordField
              label="Current password"
              value={form.current}
              onChange={(v) => setField('current', v)}
              visible={show.current}
              onToggle={() => toggleShow('current')}
              autoComplete="current-password"
            />
            <PasswordField
              label="New password"
              value={form.next}
              onChange={(v) => setField('next', v)}
              visible={show.next}
              onToggle={() => toggleShow('next')}
              autoComplete="new-password"
              placeholder="At least 8 characters"
            />
            <PasswordField
              label="Confirm new password"
              value={form.confirm}
              onChange={(v) => setField('confirm', v)}
              visible={show.confirm}
              onToggle={() => toggleShow('confirm')}
              autoComplete="new-password"
              placeholder="Re-enter new password"
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
              {pwSuccess ? (
                <p className="m-0 rounded-[8px] bg-emerald-50 px-3 py-2 text-[0.8rem] text-emerald-700">
                  Password updated.
                </p>
              ) : pwError ? (
                <p className="m-0 rounded-[8px] bg-red-50 px-3 py-2 text-[0.8rem] text-red-700" role="alert">
                  {pwError}
                </p>
              ) : (
                <span />
              )}

              <button
                type="submit"
                disabled={pwSubmitting}
                className="inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-[#2C5EF5] px-3 text-[0.8rem] font-semibold text-white transition-colors hover:bg-[#1E47C9] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Lock size={14} strokeWidth={2.25} aria-hidden="true" />
                {pwSubmitting ? 'Updating…' : 'Update password'}
              </button>
            </div>
          </form>
        </motion.section>

        {/* Sessions */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col gap-3 rounded-[16px] border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,20,25,0.04)]"
          aria-label="Sessions"
        >
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#2C5EF5]/10 text-[#2C5EF5]"
              aria-hidden="true"
            >
              <ShieldCheck size={18} strokeWidth={2} />
            </span>
            <p className="m-0 text-[0.95rem] font-semibold text-[#0F1419]">Sessions</p>
          </div>

          <div>
            <p className="m-0 text-[0.65rem] font-medium uppercase tracking-[0.1em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
              Signed in as
            </p>
            <p className="m-0 mt-1 truncate text-[0.9rem] text-[#0F1419]">{user?.email ?? '—'}</p>
          </div>
          <div>
            <p className="m-0 text-[0.65rem] font-medium uppercase tracking-[0.1em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
              Last sign-in
            </p>
            <p className="m-0 mt-1 text-[0.9rem] text-[#0F1419]">
              {fmtDateTime(user?.last_sign_in_at)}
            </p>
          </div>

          <p className="mt-1 rounded-[8px] bg-slate-50 px-3 py-2 text-[0.75rem] text-[#4A5568]">
            Signing out everywhere ends every active session for your account,
            on this and any other device.
          </p>

          <button
            type="button"
            onClick={handleSignOutAll}
            disabled={signingOut}
            className="mt-auto inline-flex h-9 items-center justify-center gap-1.5 rounded-[8px] border border-slate-200 bg-white px-3 text-[0.8rem] font-medium text-[#4A5568] transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogOut size={14} strokeWidth={2.25} aria-hidden="true" />
            {signingOut ? 'Signing out…' : 'Sign out of all devices'}
          </button>
        </motion.section>
      </section>
    </AdminLayout>
  )
}

// Local password input with show/hide toggle — shaped to this page's look,
// mirroring the Eye/EyeOff pattern used on the auth pages.
function PasswordField({
  label,
  value,
  onChange,
  visible,
  onToggle,
  autoComplete,
  placeholder,
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[0.7rem] font-medium uppercase tracking-[0.1em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
        {label}
      </span>
      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required
          className="h-10 w-full rounded-[8px] border border-slate-200 bg-white px-3 pr-11 text-[0.9rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:ring-2 focus:ring-[#2C5EF5]/20"
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="absolute right-1 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[6px] text-[#94A3B8] transition-colors hover:bg-slate-100 hover:text-[#0F1419]"
        >
          {visible ? (
            <EyeOff size={15} strokeWidth={2} aria-hidden="true" />
          ) : (
            <Eye size={15} strokeWidth={2} aria-hidden="true" />
          )}
        </button>
      </div>
    </label>
  )
}

export default SecuritySettings
