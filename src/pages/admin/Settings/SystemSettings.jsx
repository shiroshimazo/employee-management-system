import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { CalendarClock, Save, Settings as SettingsIcon } from 'lucide-react'
import AdminLayout from '../../../layouts/AdminLayout.jsx'
import { LoadingButtonLabel } from '../../../components/common/LoadingBars.jsx'
import {
  POLICY_DEFAULTS,
  getSettings,
  updateSettings,
} from '../../../services/settings.service.js'

/**
 * SystemSettings — editor for the single organization settings row.
 *
 * Backed by org_settings (012_create_settings.sql + 013_add_policy_settings.sql).
 * If 012 hasn't been run, getSettings() returns null and we show a hint. If
 * 012 ran but not 013, the policy columns are absent; we detect that
 * (policyAvailable) and avoid sending policy fields in the save so the org
 * fields still persist.
 *
 * The policy fields have real teeth: late_cutoff / half_day_hours / working_days
 * drive attendance tagging + the dashboard's absent derivation, and the leave_*
 * fields gate leave submission (see attendance.service / leave.service).
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

// JS getDay() numbering: 0=Sun … 6=Sat. Labels for the working-days toggle.
const DAYS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
]

function SystemSettings() {
  const [form, setForm] = useState({
    organization_name: '',
    support_email: '',
    timezone: 'UTC',
    late_cutoff: POLICY_DEFAULTS.late_cutoff,
    half_day_hours: POLICY_DEFAULTS.half_day_hours,
    working_days: POLICY_DEFAULTS.working_days,
    leave_min_notice_days: POLICY_DEFAULTS.leave_min_notice_days,
    leave_max_consecutive_days: POLICY_DEFAULTS.leave_max_consecutive_days,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  // Distinguish "012 not run" (null row) from a load error.
  const [missing, setMissing] = useState(false)
  // Whether the 013 policy columns exist on the loaded row.
  const [policyAvailable, setPolicyAvailable] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getSettings()
      if (!data) {
        setMissing(true)
        return
      }
      const hasPolicy = 'late_cutoff' in data
      setPolicyAvailable(hasPolicy)
      setForm({
        organization_name: data.organization_name ?? '',
        support_email: data.support_email ?? '',
        timezone: data.timezone ?? 'UTC',
        late_cutoff: data.late_cutoff ?? POLICY_DEFAULTS.late_cutoff,
        half_day_hours: data.half_day_hours ?? POLICY_DEFAULTS.half_day_hours,
        working_days: Array.isArray(data.working_days)
          ? data.working_days
          : POLICY_DEFAULTS.working_days,
        leave_min_notice_days: data.leave_min_notice_days ?? POLICY_DEFAULTS.leave_min_notice_days,
        leave_max_consecutive_days:
          data.leave_max_consecutive_days ?? POLICY_DEFAULTS.leave_max_consecutive_days,
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

  function toggleDay(day) {
    setForm((prev) => {
      const has = prev.working_days.includes(day)
      const next = has
        ? prev.working_days.filter((d) => d !== day)
        : [...prev.working_days, day].sort((a, b) => a - b)
      return { ...prev, working_days: next }
    })
    setSuccess(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(false)
    try {
      const patch = {
        organization_name: form.organization_name.trim(),
        support_email: form.support_email.trim() || null,
        timezone: form.timezone,
      }
      // Only send policy fields if the 013 columns exist — otherwise the
      // whole update would fail on the unknown columns and even the org
      // fields wouldn't save.
      if (policyAvailable) {
        patch.late_cutoff = form.late_cutoff
        patch.half_day_hours = Number(form.half_day_hours) || POLICY_DEFAULTS.half_day_hours
        patch.working_days = form.working_days
        patch.leave_min_notice_days = Math.max(0, Number(form.leave_min_notice_days) || 0)
        patch.leave_max_consecutive_days = Math.max(0, Number(form.leave_max_consecutive_days) || 0)
      }
      await updateSettings(patch)
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
          Organization-wide details and policies for your workspace.
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
        <form onSubmit={handleSubmit} className="flex max-w-[680px] flex-col gap-4">
          {/* Organization */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-[16px] border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,20,25,0.04)]"
            aria-label="Organization settings"
          >
            <CardHeader
              icon={SettingsIcon}
              title="Organization"
              subtitle="These apply across the whole workspace."
            />
            <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
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
            </div>
          </motion.section>

          {/* Attendance & leave policy */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-[16px] border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,20,25,0.04)]"
            aria-label="Attendance and leave policy"
          >
            <CardHeader
              icon={CalendarClock}
              title="Attendance & leave policy"
              subtitle="Drives late/half-day tagging, the dashboard, and leave rules."
            />

            {!policyAvailable ? (
              <p className="mb-4 rounded-[8px] border border-amber-200 bg-amber-50/60 px-3 py-2 text-[0.8rem] text-[#4A5568]">
                Run{' '}
                <span className="[font-family:'Geist_Mono',monospace]">
                  013_add_policy_settings.sql
                </span>{' '}
                to enable these. Showing defaults for now.
              </p>
            ) : null}

            <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
              <Field
                label="Late cut-off"
                type="time"
                value={form.late_cutoff}
                onChange={(v) => set('late_cutoff', v)}
                disabled={loading || !policyAvailable}
              />
              <Field
                label="Half-day under (hours)"
                type="number"
                step="0.5"
                min="0"
                value={form.half_day_hours}
                onChange={(v) => set('half_day_hours', v)}
                disabled={loading || !policyAvailable}
              />

              <div className="col-span-2 flex flex-col gap-1.5">
                <span className="text-[0.7rem] font-medium uppercase tracking-[0.1em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
                  Working days
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {DAYS.map((d) => {
                    const active = form.working_days.includes(d.value)
                    return (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => toggleDay(d.value)}
                        disabled={loading || !policyAvailable}
                        aria-pressed={active}
                        className={`h-9 w-12 rounded-[8px] border text-[0.78rem] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                          active
                            ? 'border-[#2C5EF5] bg-[#2C5EF5] text-white'
                            : 'border-slate-200 bg-white text-[#4A5568] hover:bg-slate-50'
                        }`}
                      >
                        {d.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <Field
                label="Min. leave notice (days)"
                type="number"
                min="0"
                value={form.leave_min_notice_days}
                onChange={(v) => set('leave_min_notice_days', v)}
                disabled={loading || !policyAvailable}
                hint="0 = no minimum."
              />
              <Field
                label="Max. consecutive leave (days)"
                type="number"
                min="0"
                value={form.leave_max_consecutive_days}
                onChange={(v) => set('leave_max_consecutive_days', v)}
                disabled={loading || !policyAvailable}
                hint="0 = no limit."
              />
            </div>
          </motion.section>

          {/* Save bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
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
              {submitting ? (
                <LoadingButtonLabel label="Saving" />
              ) : (
                <>
                  <Save size={14} strokeWidth={2.25} aria-hidden="true" />
                  Save changes
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </AdminLayout>
  )
}

function CardHeader({ icon: Icon, title, subtitle }) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#2C5EF5]/10 text-[#2C5EF5]"
        aria-hidden="true"
      >
        <Icon size={18} strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <p className="m-0 text-[0.95rem] font-semibold text-[#0F1419]">{title}</p>
        <p className="m-0 text-[0.8rem] text-[#4A5568]">{subtitle}</p>
      </div>
    </div>
  )
}

function Field({
  label,
  type = 'text',
  step,
  min,
  value,
  onChange,
  placeholder,
  disabled,
  required,
  hint,
  className = '',
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-[0.7rem] font-medium uppercase tracking-[0.1em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
        {label}
        {required ? <span className="ml-1 text-red-500">*</span> : null}
      </span>
      <input
        type={type}
        step={step}
        min={min}
        value={value ?? ''}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-[8px] border border-slate-200 bg-white px-3 text-[0.9rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:ring-2 focus:ring-[#2C5EF5]/20 disabled:bg-slate-50 disabled:text-[#94A3B8]"
      />
      {hint ? <span className="text-[0.7rem] text-[#94A3B8]">{hint}</span> : null}
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
