import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createPayrollRun,
  getPayrollDashboardMetrics,
  getPayrollRuns,
} from '../services/payroll.service.js'

export function usePayrollDashboard() {
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getPayrollDashboardMetrics()
      setMetrics(data)
    } catch (err) {
      setError(err?.message ?? 'Failed to load payroll dashboard metrics.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(refresh, 0)
    return () => clearTimeout(timer)
  }, [refresh])

  return { metrics, loading, error, refresh }
}

export function usePayrollRuns({ status = '', limit = 100, offset = 0 } = {}) {
  const [runs, setRuns] = useState([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const reqTokenRef = useRef(0)

  const refresh = useCallback(async () => {
    const token = ++reqTokenRef.current
    setLoading(true)
    setError(null)

    try {
      const data = await getPayrollRuns({ status, limit, offset })
      if (token !== reqTokenRef.current) return

      setRuns(data.rows)
      setCount(data.count)
    } catch (err) {
      if (token !== reqTokenRef.current) return

      setRuns([])
      setCount(0)
      setError(err?.message ?? 'Failed to load payroll runs.')
    } finally {
      if (token === reqTokenRef.current) setLoading(false)
    }
  }, [status, limit, offset])

  const createRun = useCallback(
    async (payload) => {
      const created = await createPayrollRun(payload)
      await refresh()
      return created
    },
    [refresh],
  )

  useEffect(() => {
    const timer = setTimeout(refresh, 0)
    return () => clearTimeout(timer)
  }, [refresh])

  return { runs, count, loading, error, refresh, createRun }
}

export default usePayrollDashboard
