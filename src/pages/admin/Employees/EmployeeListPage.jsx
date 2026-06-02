import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Pencil, Plus, Trash2, Users } from 'lucide-react'
import AdminLayout from '../../../layouts/AdminLayout.jsx'
import { LoadingState } from '../../../components/common/LoadingBars.jsx'
import StatusBadge from '../../../components/common/StatusBadge.jsx'
import EmployeeFormModal from '../../../components/employees/EmployeeFormModal.jsx'
import DeleteEmployeeModal from '../../../components/employees/DeleteEmployeeModal.jsx'
import EmployeesToolbar from '../../../components/employees/EmployeesToolbar.jsx'
import {
  createEmployee,
  deleteEmployee,
  getEmployees,
  searchEmployees,
  updateEmployee,
} from '../../../services/employee.service.js'
import { getDepartments } from '../../../services/department.service.js'

/**
 * EmployeeListPage — admin employee management.
 *
 * Responsibilities:
 *   - load + cache employees and departments
 *   - debounce free-text search and dispatch through the right service call
 *     (service-level filter for status/department, JS-side merge for search)
 *   - own modal state for add / edit / delete and refetch on success
 *
 * Loading approach:
 *   We refetch on filter changes rather than diffing locally because RLS
 *   may shrink/grow the visible set between filter combinations. That's
 *   the same reason the count comes from PostgREST's `count: 'exact'`
 *   header — it reflects what the *caller* is actually allowed to see.
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

function EmployeeListPage() {
  const [rows, setRows] = useState([])
  const [count, setCount] = useState(0)
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Toolbar state
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [departmentId, setDepartmentId] = useState('')

  // Modal state
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  // Debounce token so a fast typist's prior fetch can't overwrite a newer one.
  const reqTokenRef = useRef(0)

  const load = useCallback(async () => {
    const token = ++reqTokenRef.current
    setLoading(true)
    setError(null)
    try {
      let result
      if (query.trim()) {
        // searchEmployees doesn't take filter args — apply status/department
        // client-side on top of the search result. That's good enough at HR
        // dataset sizes; promote to a SQL view if it ever isn't.
        result = await searchEmployees(query)
        if (status) result.data = result.data.filter((r) => r.status === status)
        if (departmentId) {
          result.data = result.data.filter((r) => r.department?.id === departmentId)
        }
      } else {
        result = await getEmployees({
          status: status || undefined,
          departmentId: departmentId || undefined,
        })
      }
      // Drop the response if a newer request has started.
      if (token !== reqTokenRef.current) return
      setRows(result.data ?? [])
      setCount(result.count ?? result.data?.length ?? 0)
    } catch (err) {
      if (token !== reqTokenRef.current) return
      setError(err?.message ?? 'Failed to load employees.')
      setRows([])
      setCount(0)
    } finally {
      if (token === reqTokenRef.current) setLoading(false)
    }
  }, [query, status, departmentId])

  // Debounce search keystrokes; non-search filter changes refetch immediately.
  useEffect(() => {
    const t = setTimeout(load, query.trim() ? 220 : 0)
    return () => clearTimeout(t)
  }, [load, query])

  // Departments are stable across filter changes — load once. The service
  // returns { data, count }; we only need the rows here.
  useEffect(() => {
    let alive = true
    getDepartments()
      .then((res) => alive && setDepartments(res?.data ?? []))
      .catch(() => alive && setDepartments([]))
    return () => {
      alive = false
    }
  }, [])

  const handleCreate = async (payload) => {
    await createEmployee(payload)
    await load()
  }

  const handleUpdate = async (payload) => {
    await updateEmployee(editTarget.id, payload)
    await load()
  }

  const handleDelete = async (employee) => {
    await deleteEmployee(employee.id)
    setRows((prev) => prev.filter((r) => r.id !== employee.id))
    setCount((c) => Math.max(0, c - 1))
  }

  const visibleCount = rows.length
  const totalLabel = useMemo(() => {
    if (loading) {
      return <LoadingState label="Loading" barsClassName="h-3 w-5" />
    }
    if (count === visibleCount) return `${count} ${count === 1 ? 'employee' : 'employees'}`
    return `${visibleCount} of ${count} employees`
  }, [loading, count, visibleCount])

  return (
    <AdminLayout>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="m-0 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
            Employees
          </p>
          <h1 className="m-0 mt-2 text-[2rem] font-bold leading-[1.1] tracking-[-0.01em] text-[#0F1419] max-[600px]:text-[1.6rem]">
            Employee management
          </h1>
          <p className="mb-0 mt-2 text-[0.95rem] leading-snug text-[#4A5568]">
            Add, edit, and manage employees across the organization.
          </p>
        </div>
        <span
          className="inline-flex items-center gap-2 rounded-[10px] bg-white px-3 py-2 text-[0.75rem] font-medium text-[#4A5568] shadow-[0_4px_12px_rgba(15,20,25,0.04)] [font-family:'Geist_Mono',monospace]"
          aria-label="Total employees"
        >
          <Users size={12} strokeWidth={2.25} aria-hidden="true" />
          {totalLabel}
        </span>
      </header>

      <EmployeesToolbar
        query={query}
        onQueryChange={setQuery}
        status={status}
        onStatusChange={setStatus}
        departmentId={departmentId}
        onDepartmentChange={setDepartmentId}
        departments={departments}
        trailing={
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-[#2C5EF5] px-3 text-[0.8rem] font-semibold text-white transition-colors hover:bg-[#1E47C9]"
          >
            <Plus size={14} strokeWidth={2.5} aria-hidden="true" />
            Add employee
          </button>
        }
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
        aria-label="Employees"
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left">
                {['Employee', 'Department', 'Position', 'Type', 'Hire date', 'Status', ''].map((h, i) => (
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
                  <td colSpan={7} className="px-4 py-10 text-center text-[0.85rem] text-[#4A5568]">
                    <LoadingState label="Loading employees" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center">
                    <p className="m-0 text-[0.95rem] font-semibold text-[#0F1419]">
                      No employees match.
                    </p>
                    <p className="m-0 mt-1 text-[0.85rem] text-[#4A5568]">
                      Try clearing filters or adding a new employee.
                    </p>
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.id}
                    className="transition-colors hover:bg-slate-50/60"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2C5EF5]/10 text-[0.7rem] font-semibold text-[#2C5EF5] [font-family:'Geist_Mono',monospace]"
                          aria-hidden="true"
                        >
                          {initials(r.profile?.full_name)}
                        </span>
                        <div className="min-w-0">
                          <p className="m-0 truncate text-[0.9rem] font-medium text-[#0F1419]">
                            {r.profile?.full_name ?? 'Unnamed'}
                          </p>
                          <p className="m-0 text-[0.75rem] text-[#94A3B8] [font-family:'Geist_Mono',monospace]">
                            {r.employee_number}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[0.85rem] text-[#4A5568]">
                      {r.department?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-[0.85rem] text-[#4A5568]">
                      {r.position ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge value={r.employment_type} />
                    </td>
                    <td className="px-4 py-3 text-[0.8rem] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
                      {formatDate(r.hire_date)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge value={r.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditTarget(r)}
                          aria-label={`Edit ${r.profile?.full_name ?? 'employee'}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-[#4A5568] transition-colors hover:bg-slate-100 hover:text-[#0F1419]"
                        >
                          <Pencil size={14} strokeWidth={2} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(r)}
                          aria-label={`Delete ${r.profile?.full_name ?? 'employee'}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-[#4A5568] transition-colors hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 size={14} strokeWidth={2} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.section>

      <EmployeeFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        mode="create"
        departments={departments}
        onSubmit={handleCreate}
      />

      <EmployeeFormModal
        open={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        mode="edit"
        initialValue={editTarget}
        departments={departments}
        onSubmit={handleUpdate}
      />

      <DeleteEmployeeModal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        employee={deleteTarget}
        onConfirm={handleDelete}
      />
    </AdminLayout>
  )
}

export default EmployeeListPage
