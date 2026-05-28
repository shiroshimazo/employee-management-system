/**
 * StatusBadge — semantic chip for employee status / employment type / role /
 * leave type / attendance status.
 *
 * Centralizes the tone vocabulary so the same word always reads the same
 * across the app. New statuses fall back to a neutral slate chip rather
 * than crashing — better to render an unknown label than to break the row.
 *
 * Pass `label` to override the humanized text (used for attendance's `leave`
 * which we want to read as "On Leave" without renaming the DB value).
 */

const TONE = {
  // Employee status
  active: 'bg-emerald-50 text-emerald-700',
  on_leave: 'bg-amber-50 text-amber-700',
  probation: 'bg-blue-50 text-blue-700',
  terminated: 'bg-red-50 text-red-700',
  inactive: 'bg-slate-100 text-slate-600',
  archived: 'bg-slate-100 text-slate-600',
  // Employment type
  full_time: 'bg-emerald-50 text-emerald-700',
  part_time: 'bg-blue-50 text-blue-700',
  contract: 'bg-violet-50 text-violet-700',
  intern: 'bg-amber-50 text-amber-700',
  // Role
  admin: 'bg-violet-50 text-violet-700',
  hr: 'bg-blue-50 text-blue-700',
  manager: 'bg-teal-50 text-teal-700',
  payroll: 'bg-amber-50 text-amber-700',
  employee: 'bg-slate-100 text-slate-600',
  // Leave type
  vacation: 'bg-blue-50 text-blue-700',
  sick: 'bg-amber-50 text-amber-700',
  personal: 'bg-teal-50 text-teal-700',
  bereavement: 'bg-slate-100 text-slate-600',
  unpaid: 'bg-slate-100 text-slate-600',
  maternity: 'bg-violet-50 text-violet-700',
  paternity: 'bg-violet-50 text-violet-700',
  // Leave request status
  pending: 'bg-amber-50 text-amber-700',
  approved: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-red-50 text-red-700',
  cancelled: 'bg-slate-100 text-slate-600',
  // Attendance status — `leave` collides visually with the leave-request
  // 'pending' tone, so we tint it amber-ish like 'on_leave' for the
  // employee-status read.
  present: 'bg-emerald-50 text-emerald-700',
  late: 'bg-amber-50 text-amber-700',
  absent: 'bg-red-50 text-red-700',
  half_day: 'bg-blue-50 text-blue-700',
  leave: 'bg-amber-50 text-amber-700',
  remote: 'bg-teal-50 text-teal-700',
}

// Pretty labels for values whose snake_case humanization isn't quite right.
const LABEL_OVERRIDES = {
  leave: 'On Leave',
}

// snake_case → "Snake Case" so the chip reads like prose without forcing
// every caller to format manually.
function humanize(value) {
  return String(value)
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function StatusBadge({ value, label, className = '' }) {
  if (!value) return null
  const tone = TONE[value] ?? 'bg-slate-100 text-slate-600'
  const text = label ?? LABEL_OVERRIDES[value] ?? humanize(value)
  return (
    <span
      className={`inline-flex items-center rounded-[6px] px-2 py-1 text-[0.7rem] font-semibold ${tone} ${className}`}
    >
      {text}
    </span>
  )
}

export default StatusBadge
