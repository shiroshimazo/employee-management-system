import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Save } from 'lucide-react'
import AdminLayout from '../../../layouts/AdminLayout.jsx'
import StatusBadge from '../../../components/common/StatusBadge.jsx'
import { useAuth } from '../../../hooks/useAuth.js'
import { updateProfile } from '../../../services/profile.service.js'

/**
 * MyProfilePage — self-service profile view + edit.
 *
 * What's editable here is governed by the BEFORE UPDATE trigger added in
 * 008_profiles_lockdown.sql:
 *   - editable for everyone:        full_name, phone, avatar_url
 *   - editable only for admin/HR:   role, department, position, hire_date
 * The trigger silently rewrites the locked fields back to OLD for non-
 * privileged callers, so we just don't expose them in this form.
 *
 * Read-only context (role, department, hire date) is shown so the user
 * can see their record without being able to change it.
 */

function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function MyProfilePage() {
  const { user, profile, refreshProfile } = useAuth()

  const [form, setForm] = useState({ full_name: '', phone: '', avatar_url: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  // Hydrate the form whenever the profile updates upstream.
  useEffect(() => {
    if (!profile) return
    setForm({
      full_name: profile.full_name ?? '',
      phone: profile.phone ?? '',
      avatar_url: profile.avatar_url ?? '',
    })
  }, [profile])

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setSuccess(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!user?.id) return
    setSubmitting(true)
    setError(null)
    setSuccess(false)
    try {
      const { error: err } = await updateProfile(user.id, {
        full_name: form.full_name.trim() || null,
        phone: form.phone.trim() || null,
        avatar_url: form.avatar_url.trim() || null,
      })
      if (err) throw err
      await refreshProfile?.()
      setSuccess(true)
    } catch (err) {
      setError(err?.message ?? 'Could not update your profile.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AdminLayout>
      <header className="mb-6">
        <p className="m-0 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
          Account
        </p>
        <h1 className="m-0 mt-2 text-[2rem] font-bold leading-[1.1] tracking-[-0.01em] text-[#0F1419] max-[600px]:text-[1.6rem]">
          My profile
        </h1>
        <p className="mb-0 mt-2 text-[0.95rem] leading-snug text-[#4A5568]">
          Update the personal details on your account. Role, department, and
          hire date are managed by HR.
        </p>
      </header>

      <section className="grid grid-cols-3 gap-4 max-[900px]:grid-cols-1">
        {/* Editable side */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="col-span-2 rounded-[16px] border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,20,25,0.04)] max-[900px]:col-span-1"
          aria-label="Edit profile"
        >
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
            <Field
              label="Full name"
              value={form.full_name}
              onChange={(v) => set('full_name', v)}
              className="col-span-2"
            />
            <Field label="Phone" value={form.phone} onChange={(v) => set('phone', v)} />
            <Field
              label="Email"
              value={user?.email ?? ''}
              onChange={() => {}}
              disabled
              hint="Managed via the auth provider."
            />
            <Field
              label="Avatar URL"
              value={form.avatar_url}
              onChange={(v) => set('avatar_url', v)}
              placeholder="https://…"
              className="col-span-2"
            />

            <div className="col-span-2 flex flex-wrap items-center justify-between gap-3">
              {success ? (
                <p className="m-0 rounded-[8px] bg-emerald-50 px-3 py-2 text-[0.8rem] text-emerald-700">
                  Profile saved.
                </p>
              ) : error ? (
                <p className="m-0 rounded-[8px] bg-red-50 px-3 py-2 text-[0.8rem] text-red-700">
                  {error}
                </p>
              ) : (
                <span />
              )}

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-[#2C5EF5] px-3 text-[0.8rem] font-semibold text-white transition-colors hover:bg-[#1E47C9] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save size={14} strokeWidth={2.25} aria-hidden="true" />
                {submitting ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        </motion.section>

        {/* Read-only HR context */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col gap-3 rounded-[16px] border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,20,25,0.04)]"
          aria-label="Employment details"
        >
          <p className="m-0 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
            Employment
          </p>

          <Detail label="Role">
            {profile?.role ? <StatusBadge value={profile.role} /> : '—'}
          </Detail>
          <Detail label="Department">{profile?.department ?? '—'}</Detail>
          <Detail label="Position">{profile?.position ?? '—'}</Detail>
          <Detail label="Hire date">{fmtDate(profile?.hire_date)}</Detail>

          <p className="mt-2 rounded-[8px] bg-slate-50 px-3 py-2 text-[0.75rem] text-[#4A5568]">
            Need a change? Reach out to HR — these fields are read-only here.
          </p>
        </motion.section>
      </section>
    </AdminLayout>
  )
}

function Detail({ label, children }) {
  return (
    <div>
      <p className="m-0 text-[0.65rem] font-medium uppercase tracking-[0.1em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
        {label}
      </p>
      <p className="m-0 mt-1 text-[0.9rem] text-[#0F1419]">{children}</p>
    </div>
  )
}

function Field({ label, value, onChange, hint, placeholder, disabled, className = '' }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-[0.7rem] font-medium uppercase tracking-[0.1em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
        {label}
      </span>
      <input
        type="text"
        value={value ?? ''}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-[8px] border border-slate-200 bg-white px-3 text-[0.9rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:ring-2 focus:ring-[#2C5EF5]/20 disabled:bg-slate-50 disabled:text-[#94A3B8]"
      />
      {hint ? <span className="text-[0.7rem] text-[#94A3B8]">{hint}</span> : null}
    </label>
  )
}

export default MyProfilePage
