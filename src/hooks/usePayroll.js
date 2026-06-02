import { useCallback, useEffect, useState } from 'react'
import { getPayrollDashboardMetrics } from '../services/payroll.service.js'

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

export default usePayrollDashboard
