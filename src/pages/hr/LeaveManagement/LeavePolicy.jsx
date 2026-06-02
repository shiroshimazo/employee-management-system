import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, ScrollText } from 'lucide-react'
import AdminLayout from '../../../layouts/AdminLayout.jsx'
import { LoadingButtonLabel, LoadingState } from '../../../components/common/LoadingBars.jsx'
import StatusBadge from '../../../components/common/StatusBadge.jsx'
import { getLeavePolicies, updateLeavePolicy } from '../../../services/leavePolicy.service.js'

/**
 * LeavePolicy — annual leave allowances per type (HR Leave Management panel).
 *
 * Backed by leavePolicy.service / the leave_policies table. Admin/HR edit the
 * days-per-year each leave type grants. The per-*request* rules (minimum
 * notice, maximum consecutive days) are NOT here — they live in System
 * Settings (org_settings, migration 013) and are enforced in leave.service.
 * We surface a note pointing there rather than duplicating them.
 *
 * If the 016 migration hasn't been run, the table is absent — we detect that
 * and show a hint instead of a broken page.
 */

function isMissingTableError(err) {
  const msg = (err?.message ?? '').toLowerCase()
  return (
    err?.code === '42P01' ||
    err?.code === 'PGRST205' ||
    (msg.includes('leave_policies') && msg.includes('does not exist')) ||
    msg.includes('could not find the table')
  )
}

function LeavePolicy() {
  const [rows, setRows] = useState([])
  // Local edited values keyed by leave_type, so each row edits independently.
  const [drafts, setDrafts] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [missing, setMissing] = useState(false)
  const [savingType, setSavingType] = useState(null)
  const [savedType, setSavedType] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getLeavePolicies()
      setRows(data ?? [])
      setDrafts(
        Object.fromEntries(
          (data ?? []).map((r) => [r.leave_type, String(r.annual_allowance_days ?? 0)]),
        ),
      )
    } catch (err) {
      if (isMissingTableError(err)) {
        setMissing(true)
      } else {
        setError(err?.message ?? 'Failed to load leave policies.')
      }
      setRows([])
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

  function setDraft(type, value) {
    setDrafts((prev) => ({ ...prev, [type]: value }))
    setSavedType(null)
  }

  async function handleSave(type) {
    setSavingType(type)
    setError(null)
    setSavedType(null)
    try {
      const updated = await updateLeavePolicy(type, drafts[type])
      // Reflect the saved value as the new baseline so the row is no longer dirty.
      setRows((prev) => prev.map((r) => (r.leave_type === type ? { ...r, ...updated } : r)))
      setDrafts((prev) => ({ ...prev, [type]: String(updated.annual_allowance_days) }))
      setSavedType(type)
    } catch (err) {
      setError(err?.message ?? 'Could not save the allowance.')
    } finally {
      setSavingType(null)
    }
  }

  function isDirty(r) {
    const draft = drafts[r.leave_type]
    return draft !== undefined && draft !== String(r.annual_allowance_days ?? 0)
  }

  return (
    <AdminLayout>
      <header className="mb-6">
        <p className="m-0 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
          Leave management
        </p>
        <h1 className="m-0 mt-2 text-[2rem] font-bold leading-[1.1] tracking-[-0.01em] text-[#0F1419] max-[600px]:text-[1.6rem]">
          Leave policy
        </h1>
        <p className="mb-0 mt-2 text-[0.95rem] leading-snug text-[#4A5568]">
          Annual allowance, in days, granted per leave type.
        </p>
      </header>

      {missing ? (
        <div className="rounded-[16px] border border-amber-200 bg-amber-50/60 p-5">
          <p className="m-0 text-[0.95rem] font-semibold text-[#0F1419]">Leave policies table not found.</p>
          <p className="m-0 mt-1 text-[0.85rem] text-[#4A5568]">
            Run{' '}
            <span className="[font-family:'Geist_Mono',monospace]">
              supabase/migrations/016_create_leave_policies.sql
            </span>{' '}
            in the Supabase SQL Editor, then reload this page.
          </p>
        </div>
      ) : (
        <>
          {error ? (
            <p className="mb-4 rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-[0.85rem] text-red-700" role="alert">
              {error}
            </p>
          ) : null}

          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-[680px] overflow-hidden rounded-[16px] border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,20,25,0.04)]"
            aria-label="Leave allowances"
          >
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-left">
                  {['Leave type', 'Annual allowance (days)', ''].map((h, i) => (
                    <th
                      key={i}
                      className="border-b border-slate-200 bg-slate-50/60 px-4 py-3 text-[0.65rem] font-medium uppercase tracking-[0.1em] text-[#4A5568] [font-family:'Geist_Mono',monospace]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && rows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-10 text-center text-[0.85rem] text-[#4A5568]">
                      <LoadingState label="Loading leave policies" />
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    const dirty = isDirty(r)
                    const busy = savingType === r.leave_type
                    return (
                      <tr key={r.leave_type} className="transition-colors hover:bg-slate-50/60">
                        <td className="px-4 py-3">
                          <StatusBadge value={r.leave_type} />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={drafts[r.leave_type] ?? ''}
                            onChange={(e) => setDraft(r.leave_type, e.target.value)}
                            disabled={busy}
                            aria-label={`${r.leave_type} annual allowance in days`}
                            className="h-9 w-28 rounded-[8px] border border-slate-200 bg-white px-3 text-[0.9rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:ring-2 focus:ring-[#2C5EF5]/20 disabled:bg-slate-50 disabled:text-[#94A3B8]"
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          {savedType === r.leave_type && !dirty ? (
                            <span className="mr-2 text-[0.75rem] font-medium text-emerald-700">
                              Saved
                            </span>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => handleSave(r.leave_type)}
                            disabled={!dirty || busy}
                            className="inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-[#2C5EF5] px-3 text-[0.78rem] font-semibold text-white transition-colors hover:bg-[#1E47C9] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {busy ? (
                              <LoadingButtonLabel label="Saving" />
                            ) : (
                              <>
                                <Check size={13} strokeWidth={2.5} aria-hidden="true" />
                                Save
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </motion.section>

          {/* Pointer to the per-request rules, which live in System Settings —
              we don't duplicate them here. */}
          <p className="mt-3 flex max-w-[680px] items-center gap-1.5 text-[0.78rem] text-[#94A3B8]">
            <ScrollText size={12} strokeWidth={2} aria-hidden="true" />
            Minimum notice and maximum consecutive days are set in System Settings.
          </p>
        </>
      )}
    </AdminLayout>
  )
}

export default LeavePolicy
