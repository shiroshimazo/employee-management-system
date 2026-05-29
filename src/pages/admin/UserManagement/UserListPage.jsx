import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ShieldCheck, UserCog, Users } from 'lucide-react'
import AdminLayout from '../../../layouts/AdminLayout.jsx'
import StatusBadge from '../../../components/common/StatusBadge.jsx'
import UsersToolbar from '../../../components/users/UsersToolbar.jsx'
import RoleAssignmentModal from '../../../components/users/RoleAssignmentModal.jsx'
import { useAuth } from '../../../hooks/useAuth.js'
import { getUsers, searchUsers, updateUserRole } from '../../../services/user.service.js'

/**
 * UserListPage — admin user + role management.
 *
 * Responsibilities:
 *   - load users (profiles) with role filter + free-text search
 *   - debounce search like the employee list; apply role filter client-side
 *     on top of a search result (search doesn't take filter args)
 *   - own the role-assignment modal and refresh the changed row in place
 *
 * Scope note: there's no create/delete here on purpose. Users self-register
 * at /register (the browser can't mint auth users with the anon key), and
 * deleting an auth account is a server-side concern. Admin's job here is to
 * see everyone and manage what they can access.
 */

function initials(name) {
  if (!name) return '–'
  return name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function UserListPage() {
  const { user } = useAuth()

  const [rows, setRows] = useState([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Toolbar state
  const [query, setQuery] = useState('')
  const [role, setRole] = useState('')

  // Modal state
  const [roleTarget, setRoleTarget] = useState(null)

  // Debounce token so a fast typist's prior fetch can't overwrite a newer one.
  const reqTokenRef = useRef(0)

  const load = useCallback(async () => {
    const token = ++reqTokenRef.current
    setLoading(true)
    setError(null)
    try {
      let result
      if (query.trim()) {
        // searchUsers doesn't take a role arg — filter client-side on top.
        result = await searchUsers(query)
        if (role) result.data = result.data.filter((r) => r.role === role)
      } else {
        result = await getUsers({ role: role || undefined })
      }
      if (token !== reqTokenRef.current) return
      setRows(result.data ?? [])
      setCount(result.count ?? result.data?.length ?? 0)
    } catch (err) {
      if (token !== reqTokenRef.current) return
      setError(err?.message ?? 'Failed to load users.')
      setRows([])
      setCount(0)
    } finally {
      if (token === reqTokenRef.current) setLoading(false)
    }
  }, [query, role])

  // Debounce search keystrokes; role filter changes refetch immediately.
  useEffect(() => {
    const t = setTimeout(load, query.trim() ? 220 : 0)
    return () => clearTimeout(t)
  }, [load, query])

  const handleRoleChange = async (newRole) => {
    const updated = await updateUserRole(roleTarget.id, newRole)
    // Patch the row in place so the table reflects the new role without a
    // full refetch (which would also reset scroll/filters).
    setRows((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)))
  }

  const visibleCount = rows.length
  const totalLabel = useMemo(() => {
    if (loading) return 'Loading…'
    if (count === visibleCount) return `${count} ${count === 1 ? 'user' : 'users'}`
    return `${visibleCount} of ${count} users`
  }, [loading, count, visibleCount])

  return (
    <AdminLayout>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="m-0 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
            Users
          </p>
          <h1 className="m-0 mt-2 text-[2rem] font-bold leading-[1.1] tracking-[-0.01em] text-[#0F1419] max-[600px]:text-[1.6rem]">
            User management
          </h1>
          <p className="mb-0 mt-2 text-[0.95rem] leading-snug text-[#4A5568]">
            Review everyone with an account and manage what they can access.
          </p>
        </div>
        <span
          className="inline-flex items-center gap-2 rounded-[10px] bg-white px-3 py-2 text-[0.75rem] font-medium text-[#4A5568] shadow-[0_4px_12px_rgba(15,20,25,0.04)] [font-family:'Geist_Mono',monospace]"
          aria-label="Total users"
        >
          <Users size={12} strokeWidth={2.25} aria-hidden="true" />
          {totalLabel}
        </span>
      </header>

      <UsersToolbar
        query={query}
        onQueryChange={setQuery}
        role={role}
        onRoleChange={setRole}
      />

      {error ? (
        <p className="mt-4 rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-[0.85rem] text-red-700">
          {error}
        </p>
      ) : null}

      {/* Table */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="mt-4 overflow-hidden rounded-[16px] border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,20,25,0.04)]"
        aria-label="Users"
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left">
                {['User', 'Phone', 'Role', 'Joined', ''].map((h, i) => (
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
                  <td colSpan={5} className="px-4 py-10 text-center text-[0.85rem] text-[#4A5568]">
                    Loading users…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center">
                    <p className="m-0 text-[0.95rem] font-semibold text-[#0F1419]">
                      No users match.
                    </p>
                    <p className="m-0 mt-1 text-[0.85rem] text-[#4A5568]">
                      Try clearing the search or role filter.
                    </p>
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const isSelf = r.id === user?.id
                  return (
                    <tr key={r.id} className="transition-colors hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2C5EF5]/10 text-[0.7rem] font-semibold text-[#2C5EF5] [font-family:'Geist_Mono',monospace]"
                            aria-hidden="true"
                          >
                            {initials(r.full_name)}
                          </span>
                          <div className="min-w-0">
                            <p className="m-0 flex items-center gap-1.5 truncate text-[0.9rem] font-medium text-[#0F1419]">
                              {r.full_name ?? 'Unnamed'}
                              {isSelf ? (
                                <span className="rounded-[5px] bg-slate-100 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-[#4A5568]">
                                  You
                                </span>
                              ) : null}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[0.85rem] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
                        {r.phone ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge value={r.role} />
                      </td>
                      <td className="px-4 py-3 text-[0.8rem] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
                        {formatDate(r.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setRoleTarget(r)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-slate-200 bg-white px-2.5 text-[0.75rem] font-medium text-[#4A5568] transition-colors hover:border-[#2C5EF5]/40 hover:bg-slate-50 hover:text-[#0F1419]"
                        >
                          <UserCog size={13} strokeWidth={2} aria-hidden="true" />
                          Change role
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </motion.section>

      {/* Footnote: clarify why there's no "add user" here. */}
      <p className="mt-3 flex items-center gap-1.5 text-[0.75rem] text-[#94A3B8]">
        <ShieldCheck size={12} strokeWidth={2} aria-hidden="true" />
        New users sign up at the registration page. Role changes are recorded in
        the audit log.
      </p>

      <RoleAssignmentModal
        open={Boolean(roleTarget)}
        onClose={() => setRoleTarget(null)}
        user={roleTarget}
        currentUserId={user?.id}
        onConfirm={handleRoleChange}
      />
    </AdminLayout>
  )
}

export default UserListPage
