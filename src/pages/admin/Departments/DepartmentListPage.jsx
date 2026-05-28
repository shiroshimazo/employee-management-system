import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Building2, Pencil, Plus, Trash2, Users } from 'lucide-react'
import AdminLayout from '../../../layouts/AdminLayout.jsx'
import StatusBadge from '../../../components/common/StatusBadge.jsx'
import DepartmentFormModal from '../../../components/departments/DepartmentFormModal.jsx'
import DeleteDepartmentModal from '../../../components/departments/DeleteDepartmentModal.jsx'
import DepartmentsToolbar from '../../../components/departments/DepartmentsToolbar.jsx'
import {
  createDepartment,
  deleteDepartment,
  getDepartmentEmployeeCounts,
  getDepartments,
  getManagerCandidates,
  searchDepartments,
  updateDepartment,
} from '../../../services/department.service.js'

/**
 * DepartmentListPage — admin department management.
 *
 * Mirrors EmployeeListPage in shape and behavior:
 *   - debounced search via the same race-guarded request token pattern
 *   - filter changes refetch through the right service path
 *   - modal state for add / edit / delete with optimistic row removal
 *   - employee counts fetched in a single batched query after each refetch
 *
 * RLS handles authorization: admin/HR see and write all; managers see their
 * own department; employees see only the department they're attached to.
 * Counts come from a separate query against `employees`, so they reflect
 * what the *caller* is allowed to see — which is the right behavior.
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

function DepartmentListPage() {
  const [rows, setRows] = useState([])
  const [count, setCount] = useState(0)
  const [counts, setCounts] = useState({}) // { [departmentId]: number }
  const [managers, setManagers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Toolbar state
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')

  // Modal state
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const reqTokenRef = useRef(0)

  const load = useCallback(async () => {
    const token = ++reqTokenRef.current
    setLoading(true)
    setError(null)
    try {
      let result
      if (query.trim()) {
        result = await searchDepartments(query)
        // searchDepartments doesn't take filter args — apply status
        // client-side on top of the search result. Fine at department-scale.
        if (status) {
          result = { ...result, data: result.data.filter((r) => r.status === status) }
        }
      } else {
        result = await getDepartments({ status: status || undefined })
      }
      if (token !== reqTokenRef.current) return
      const data = result.data ?? []
      setRows(data)
      setCount(result.count ?? data.length)

      // Batch employee counts for visible rows.
      const ids = data.map((r) => r.id)
      const tally = await getDepartmentEmployeeCounts(ids)
      if (token !== reqTokenRef.current) return
      setCounts(tally)
    } catch (err) {
      if (token !== reqTokenRef.current) return
      setError(err?.message ?? 'Failed to load departments.')
      setRows([])
      setCount(0)
      setCounts({})
    } finally {
      if (token === reqTokenRef.current) setLoading(false)
    }
  }, [query, status])

  // Debounce search keystrokes; non-search filter changes refetch immediately.
  useEffect(() => {
    const t = setTimeout(load, query.trim() ? 220 : 0)
    return () => clearTimeout(t)
  }, [load, query])

  // Manager candidates are stable across filter changes — load once. If the
  // call fails (e.g. RLS denies it for a non-privileged caller), the dropdown
  // simply has no options, which is fine for the view-only path.
  useEffect(() => {
    let alive = true
    getManagerCandidates()
      .then((d) => alive && setManagers(d ?? []))
      .catch(() => alive && setManagers([]))
    return () => {
      alive = false
    }
  }, [])

  const handleCreate = async (payload) => {
    await createDepartment(payload)
    await load()
  }

  const handleUpdate = async (payload) => {
    await updateDepartment(editTarget.id, payload)
    await load()
  }

  const handleDelete = async (department) => {
    await deleteDepartment(department.id)
    setRows((prev) => prev.filter((r) => r.id !== department.id))
    setCount((c) => Math.max(0, c - 1))
    setCounts((prev) => {
      const next = { ...prev }
      delete next[department.id]
      return next
    })
  }

  const visibleCount = rows.length
  const totalLabel = useMemo(() => {
    if (loading) return 'Loading…'
    if (count === visibleCount) {
      return `${count} ${count === 1 ? 'department' : 'departments'}`
    }
    return `${visibleCount} of ${count} departments`
  }, [loading, count, visibleCount])

  return (
    <AdminLayout>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="m-0 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
            Departments
          </p>
          <h1 className="m-0 mt-2 text-[2rem] font-bold leading-[1.1] tracking-[-0.01em] text-[#0F1419] max-[600px]:text-[1.6rem]">
            Department management
          </h1>
          <p className="mb-0 mt-2 text-[0.95rem] leading-snug text-[#4A5568]">
            Organize teams, assign managers, and track headcount per department.
          </p>
        </div>
        <span
          className="inline-flex items-center gap-2 rounded-[10px] bg-white px-3 py-2 text-[0.75rem] font-medium text-[#4A5568] shadow-[0_4px_12px_rgba(15,20,25,0.04)] [font-family:'Geist_Mono',monospace]"
          aria-label="Total departments"
        >
          <Building2 size={12} strokeWidth={2.25} aria-hidden="true" />
          {totalLabel}
        </span>
      </header>

      <DepartmentsToolbar
        query={query}
        onQueryChange={setQuery}
        status={status}
        onStatusChange={setStatus}
        trailing={
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-[#2C5EF5] px-3 text-[0.8rem] font-semibold text-white transition-colors hover:bg-[#1E47C9]"
          >
            <Plus size={14} strokeWidth={2.5} aria-hidden="true" />
            Add department
          </button>
        }
      />

      {error ? (
        <p className="mt-4 rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-[0.85rem] text-red-700">
          {error}
        </p>
      ) : null}

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="mt-4 overflow-hidden rounded-[16px] border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,20,25,0.04)]"
        aria-label="Departments"
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left">
                {[
                  'Department',
                  'Manager',
                  'Employees',
                  'Status',
                  'Created',
                  '',
                ].map((h, i) => (
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
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-[0.85rem] text-[#4A5568]"
                  >
                    Loading departments…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center">
                    <p className="m-0 text-[0.95rem] font-semibold text-[#0F1419]">
                      No departments match.
                    </p>
                    <p className="m-0 mt-1 text-[0.85rem] text-[#4A5568]">
                      Try clearing filters or adding a new department.
                    </p>
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const empCount = counts[r.id] ?? 0
                  return (
                    <tr key={r.id} className="transition-colors hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#2C5EF5]/10 text-[#2C5EF5]"
                            aria-hidden="true"
                          >
                            <Building2 size={16} strokeWidth={2} />
                          </span>
                          <div className="min-w-0">
                            <p className="m-0 truncate text-[0.9rem] font-medium text-[#0F1419]">
                              {r.name}
                            </p>
                            <p className="m-0 text-[0.75rem] text-[#94A3B8] [font-family:'Geist_Mono',monospace]">
                              {r.code ?? '—'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {r.manager ? (
                          <div className="flex items-center gap-2">
                            <span
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0F1419]/[0.06] text-[0.65rem] font-semibold text-[#0F1419] [font-family:'Geist_Mono',monospace]"
                              aria-hidden="true"
                            >
                              {initials(r.manager.full_name)}
                            </span>
                            <span className="text-[0.85rem] text-[#0F1419]">
                              {r.manager.full_name ?? 'Unnamed'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[0.85rem] text-[#94A3B8]">— Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 rounded-[6px] bg-slate-100 px-2 py-1 text-[0.75rem] font-semibold text-[#0F1419] [font-family:'Geist_Mono',monospace]">
                          <Users size={12} strokeWidth={2.25} aria-hidden="true" />
                          {empCount}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge value={r.status} />
                      </td>
                      <td className="px-4 py-3 text-[0.8rem] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
                        {formatDate(r.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setEditTarget(r)}
                            aria-label={`Edit ${r.name}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-[#4A5568] transition-colors hover:bg-slate-100 hover:text-[#0F1419]"
                          >
                            <Pencil size={14} strokeWidth={2} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(r)}
                            aria-label={`Delete ${r.name}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-[#4A5568] transition-colors hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 size={14} strokeWidth={2} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </motion.section>

      <DepartmentFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        mode="create"
        managers={managers}
        onSubmit={handleCreate}
      />

      <DepartmentFormModal
        open={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        mode="edit"
        initialValue={editTarget}
        managers={managers}
        onSubmit={handleUpdate}
      />

      <DeleteDepartmentModal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        department={deleteTarget}
        employeeCount={deleteTarget ? counts[deleteTarget.id] ?? 0 : 0}
        onConfirm={handleDelete}
      />
    </AdminLayout>
  )
}

export default DepartmentListPage
