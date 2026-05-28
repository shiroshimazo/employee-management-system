import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Clock, LogIn, LogOut } from 'lucide-react'
import StatusBadge from '../common/StatusBadge.jsx'
import { computeTotalHours } from '../../services/attendance.service.js'

/**
 * AttendanceClockCard — today's punch surface for the employee.
 *
 * Shows the current state in three modes:
 *   1. No record yet today → "Clock in" CTA
 *   2. Clocked in, no out  → live elapsed timer + "Clock out" CTA
 *   3. Clocked out          → final summary, no CTA
 *
 * The page hands us `today` (the row from getTodayAttendance) and the two
 * action handlers; we keep the busy / error state local because they only
 * matter to this card.
 *
 * The elapsed timer is a 1s interval that's only mounted while we're in
 * the "in but not out" window — no work happens at rest.
 */

function fmtTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function fmtElapsed(ms) {
  if (ms <= 0) return '0h 00m'
  const totalMin = Math.floor(ms / 60_000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${h}h ${String(m).padStart(2, '0')}m`
}

function AttendanceClockCard({ today, onClockIn, onClockOut, disabled = false }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const checkedIn = Boolean(today?.check_in)
  const checkedOut = Boolean(today?.check_out)
  const onLeave = today?.status === 'leave'

  // Tick every second only while the elapsed timer is meaningful.
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!checkedIn || checkedOut) return
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [checkedIn, checkedOut])

  const elapsedMs =
    checkedIn && !checkedOut
      ? Date.now() - new Date(today.check_in).getTime()
      : 0

  const totalHours =
    checkedIn && checkedOut ? computeTotalHours(today.check_in, today.check_out) : null

  async function handle(fn) {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(err?.message ?? 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col gap-4 rounded-[16px] border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,20,25,0.04)]"
      aria-label="Today's attendance"
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
            Today
          </p>
          <p className="m-0 mt-1 text-[0.85rem] text-[#4A5568]">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>
        {today?.status ? <StatusBadge value={today.status} /> : null}
      </header>

      {/* Stats row: in / out / total */}
      <div className="grid grid-cols-3 gap-2 max-[480px]:grid-cols-1">
        <Stat icon={LogIn} label="Clock in" value={fmtTime(today?.check_in)} />
        <Stat icon={LogOut} label="Clock out" value={fmtTime(today?.check_out)} />
        <Stat
          icon={Clock}
          label={checkedOut ? 'Total' : 'Elapsed'}
          value={
            checkedOut
              ? totalHours != null
                ? `${totalHours}h`
                : '—'
              : checkedIn
                ? fmtElapsed(elapsedMs + tick * 0)
                : '—'
          }
        />
      </div>

      {/* CTA / state copy */}
      {onLeave ? (
        <p className="m-0 rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2 text-[0.85rem] text-amber-800">
          You're on approved leave today. No clock-in needed.
        </p>
      ) : checkedOut ? (
        <p className="m-0 rounded-[10px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-[0.85rem] text-emerald-800">
          You're done for the day. Have a good evening.
        </p>
      ) : checkedIn ? (
        <button
          type="button"
          onClick={() => handle(onClockOut)}
          disabled={busy || disabled}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-[10px] bg-[#0F1419] px-4 text-[0.85rem] font-semibold text-white transition-colors hover:bg-[#1A222B] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <LogOut size={14} strokeWidth={2.25} aria-hidden="true" />
          {busy ? 'Clocking out…' : 'Clock out'}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => handle(onClockIn)}
          disabled={busy || disabled}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-[10px] bg-[#2C5EF5] px-4 text-[0.85rem] font-semibold text-white transition-colors hover:bg-[#1E47C9] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <LogIn size={14} strokeWidth={2.25} aria-hidden="true" />
          {busy ? 'Clocking in…' : 'Clock in'}
        </button>
      )}

      {error ? (
        <p className="m-0 rounded-[8px] bg-red-50 px-3 py-2 text-[0.8rem] text-red-700">
          {error}
        </p>
      ) : null}
    </motion.section>
  )
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="flex flex-col gap-1 rounded-[10px] border border-slate-200 bg-slate-50/60 p-3">
      <span className="flex items-center gap-1 text-[0.65rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
        <Icon size={11} strokeWidth={2.25} aria-hidden="true" />
        {label}
      </span>
      <span className="text-[1.1rem] font-semibold leading-none text-[#0F1419] [font-family:'Geist',sans-serif]">
        {value}
      </span>
    </div>
  )
}

export default AttendanceClockCard
