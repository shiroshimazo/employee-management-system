import { useEffect, useState } from 'react'
import { AlertTriangle, ShieldAlert } from 'lucide-react'
import Modal from '../common/Modal/Modal.jsx'
import { LoadingButtonLabel } from '../common/LoadingBars.jsx'
import StatusBadge from '../common/StatusBadge.jsx'
import { ROLES } from '../../services/user.service.js'

/**
 * RoleAssignmentModal — change a single user's role.
 *
 * This is the one privileged action in User Management, so it carries two
 * guards the rest of the app relies on:
 *   - Admin elevation warning: promoting someone to `admin` grants full
 *     access; we make the admin acknowledge that, not slip it past them.
 *   - Self-demotion guard: an admin changing their *own* role away from admin
 *     can lock themselves (and possibly everyone) out. We block it here and
 *     tell them to have another admin do it.
 *
 * Props:
 *   open, onClose, user (target profile row), currentUserId, onConfirm(role)
 */

const ROLE_LABELS = {
  admin: 'Admin',
  hr: 'HR',
  manager: 'Manager',
  payroll: 'Payroll',
  employee: 'Employee',
}

const ROLE_HINTS = {
  admin: 'Manage users, system settings, and back-office pages.',
  hr: 'Manage HR records, leave workflows, recruitment, and compliance.',
  manager: 'View and approve their team’s leave and attendance.',
  payroll: 'Access payroll runs, compensation, and tax settings.',
  employee: 'Self-service only — their own attendance, leave, and profile.',
}

function RoleAssignmentModal({ open, onClose, user, currentUserId, onConfirm }) {
  const [role, setRole] = useState(user?.role ?? 'employee')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  // Re-seed the picker whenever the modal opens or the target changes, so it
  // never shows the previously-edited user's role.
  useEffect(() => {
    if (!open) return
    setRole(user?.role ?? 'employee')
    setError(null)
  }, [open, user])

  const name = user?.full_name ?? 'this user'
  const currentRole = user?.role ?? 'employee'
  const isSelf = Boolean(user?.id) && user.id === currentUserId
  const unchanged = role === currentRole
  // An admin demoting their own account is the lock-out risk we guard against.
  const selfDemotion = isSelf && currentRole === 'admin' && role !== 'admin'
  const elevatingToAdmin = role === 'admin' && currentRole !== 'admin'

  async function handleConfirm() {
    if (unchanged || selfDemotion) return
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm(role)
      onClose?.()
    } catch (err) {
      setError(err?.message ?? 'Could not update this user’s role.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onClose}
      size="sm"
      title="Change role"
      description={`Update what ${name} can access.`}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="inline-flex h-9 items-center rounded-[8px] border border-slate-200 bg-white px-3 text-[0.8rem] font-medium text-[#4A5568] transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting || !user || unchanged || selfDemotion}
            className="inline-flex h-9 items-center rounded-[8px] bg-[#2C5EF5] px-3 text-[0.8rem] font-semibold text-white transition-colors hover:bg-[#1E47C9] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? <LoadingButtonLabel label="Saving" /> : 'Save role'}
          </button>
        </>
      }
    >
      {/* Who + current role */}
      <div className="mb-4 flex items-center justify-between gap-3 rounded-[10px] border border-slate-200 bg-slate-50/60 px-3 py-2.5">
        <p className="m-0 min-w-0 truncate text-[0.9rem] font-medium text-[#0F1419]">
          {name}
        </p>
        <span className="flex shrink-0 items-center gap-1.5 text-[0.75rem] text-[#4A5568]">
          Current
          <StatusBadge value={currentRole} />
        </span>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[0.7rem] font-medium uppercase tracking-[0.1em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
          New role
        </span>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          disabled={submitting}
          className="h-10 rounded-[8px] border border-slate-200 bg-white px-3 text-[0.9rem] text-[#0F1419] outline-none transition-colors focus:border-[#2C5EF5] focus:ring-2 focus:ring-[#2C5EF5]/20 disabled:opacity-60"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r] ?? r}
            </option>
          ))}
        </select>
        <span className="text-[0.7rem] text-[#94A3B8]">{ROLE_HINTS[role]}</span>
      </label>

      {/* Self-demotion is blocked outright. */}
      {selfDemotion ? (
        <div className="mt-4 flex items-start gap-3 rounded-[10px] border border-red-100 bg-red-50/60 p-3">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700"
            aria-hidden="true"
          >
            <ShieldAlert size={15} strokeWidth={2.25} />
          </span>
          <p className="m-0 text-[0.8rem] text-[#0F1419]">
            You can’t remove your own admin role — that could lock you out. Ask
            another admin to make this change.
          </p>
        </div>
      ) : elevatingToAdmin ? (
        <div className="mt-4 flex items-start gap-3 rounded-[10px] border border-amber-100 bg-amber-50/60 p-3">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700"
            aria-hidden="true"
          >
            <AlertTriangle size={15} strokeWidth={2.25} />
          </span>
          <p className="m-0 text-[0.8rem] text-[#0F1419]">
            Admins can manage users and system settings. Only grant this to
            people who need that responsibility.
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="m-0 mt-3 rounded-[8px] bg-red-50 px-3 py-2 text-[0.8rem] text-red-700">
          {error}
        </p>
      ) : null}
    </Modal>
  )
}

export default RoleAssignmentModal
