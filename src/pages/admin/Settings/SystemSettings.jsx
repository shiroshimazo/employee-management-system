import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Save, Settings as SettingsIcon } from 'lucide-react'
import AdminLayout from '../../../layouts/AdminLayout.jsx'
import { getSettings, updateSettings } from '../../../services/settings.service.js'

/**
 * SystemSettings — editor for the single organization settings row.
 *
 * Backed by org_settings (012_create_settings.sql). If that migration hasn't
 * been run yet, getSettings() returns null and we show a hint to run it rather
 * than rendering an empty form that can't save.
 *
 * Scope: only the values that genuinely persist today — org name, support
 * email, timezone. No policy toggles, since the anon key can't enforce them.
 */

// A short, common timezone list — enough to be useful without shipping the
// full tz database. Stored as the IANA name.
const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Asia/Manila',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
]

function SystemSettings() {
  const [form, setForm] = useState({ organization_name: '', support_email: '', timezone: 'UTC' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  // Distinguish "migration not run" (null row) from a load error.
  const [missing, setMissing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getSettings()
      if (!data) {
        setMissing(true)
        return
      }
      setForm({
        organization_name: data.organization_name ?? '',
        support_email: data.support_email ?? '',
        timezone: data.timezone ?? 'UTC',
      })
    } catch (err) {
      setError(err?.message ?? 'Failed to load settings.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Defer the load out of the synchronous effect body — same pattern the
  // other admin pages use to keep setState off the render path.
  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setSuccess(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(false)
    try {
      await updateSettings({
        organization_name: form.organization_name.trim(),
        support_email: form.support_email.trim() || null,
        timezone: form.timezone,
      })
      setSuccess(true)
    } catch (err) {
      setError(err?.message ?? 'Could not save settings.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AdminLayout>
      <header className="mb-6">
        <p className="m-0 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
          Settings
        </p>
        <h1 className="m-0 mt-2 text-[2rem] font-bold leading-[1.1] tracking-[-0.01em] text-[#0F1419] max-[600px]:text-[1.6rem]">
          System settings
        </h1>
        <p className="mb-0 mt-2 text-[0.95rem] leading-snug text-[#4A5568]">
          Organization-wide details for your workspace.
        </p>
      </header>

      {missing ? (
        <div className="rounded-[16px] border border-amber-200 bg-amber-50/60 p-5">
          <p className="m-0 text-[0.95rem] font-semibold text-[#0F1419]">Settings table not found.</p>
          <p className="m-0 mt-1 text-[0.85rem] text-[#4A5568]">
            Run <span className="[font-family:'Geist_Mono',monospace]">supabase/migrations/012_create_settings.sql</span>{' '}
            in the Supabase SQL Editor, then reload this page.
          </p>
        </div>
      ) : (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-[680px] rounded-[16px] border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,20,25,0.04)]"
          aria-label="Organization settings"
        >
          <div className="mb-4 flex items-center gap-2.5">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#2C5EF5]/10 text-[#2C5EF5]"
              aria-hidden="true"
            >
              <SettingsIcon size={18} strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <p className="m-0 text-[0.95rem] font-semibold text-[#0F1419]">Organization</p>
              <p className="m-0 text-[0.8rem] text-[#4A5568]">
                These apply across the whole workspace.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
            <Field
              label="Organization name"
              value={form.organization_name}
              onChange={(v) => set('organization_name', v)}
              disabled={loading}
              required
              className="col-span-2"
            />
            <Field
              label="Support email"
              type="email"
              value={form.support_email}
              onChange={(v) => set('support_email', v)}
              disabled={loading}
              placeholder="support@example.com"
            />
            <SelectField
              label="Timezone"
              value={form.timezone}
              onChange={(v) => set('timezone', v)}
              disabled={loading}
              options={TIMEZONES}
            />

            <div className="col-span-2 flex flex-wrap items-center justify-between gap-3">
              {success ? (
                <p className="m-0 rounded-[8px] bg-emerald-50 px-3 py-2 text-[0.8rem] text-emerald-700">
                  Settings saved.
                </p>
              ) : error ? (
                <p className="m-0 rounded-[8px] bg-red-50 px-3 py-2 text-[0.8rem] text-red-700" role="alert">
                  {error}
                </p>
              ) : (
                <span />
              )}

              <button
                type="submit"
                disabled={submitting || loading}
                className="inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-[#2C5EF5] px-3 text-[0.8rem] font-semibold text-white transition-colors hover:bg-[#1E47C9] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save size={14} strokeWidth={2.25} aria-hidden="true" />
                {submitting ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        </motion.section>
      )}
    </AdminLayout>
  )
}

function Field({ label, type = 'text', value, onChange, placeholder, disabled, required, className = '' }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-[0.7rem] font-medium uppercase tracking-[0.1em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
        {label}
        {required ? <span className="ml-1 text-red-500">*</span> : null}
      </span>
      <input
        type={type}
        value={value ?? ''}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-[8px] border border-slate-200 bg-white px-3 text-[0.9rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:ring-2 focus:ring-[#2C5EF5]/20 disabled:bg-slate-50 disabled:text-[#94A3B8]"
      />
    </label>
  )
}

function SelectField({ label, value, onChange, options, disabled }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[0.7rem] font-medium uppercase tracking-[0.1em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
        {label}
      </span>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="h-10 rounded-[8px] border border-slate-200 bg-white px-3 text-[0.9rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:ring-2 focus:ring-[#2C5EF5]/20 disabled:bg-slate-50 disabled:text-[#94A3B8]"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  )
}

export default SystemSettings
