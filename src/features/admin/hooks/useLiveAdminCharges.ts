import { useEffect, useState } from 'react'
import { getAdminCharges, type AdminChargeRow } from '@/features/admin/services/adminChargeService'

const REFRESH_INTERVAL_MS = 15_000

/**
 * Loads the charges of a hall and keeps them fresh (every 15 s and when the window regains focus) without
 * hiding the data already shown. On failure the last loaded rows stay available next to the error.
 */
export function useLiveAdminCharges(hallId: string | null) {
  const [rows, setRows] = useState<AdminChargeRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let requestInFlight = false

    const load = async (initialLoad = false) => {
      if (!hallId) {
        setLoading(false)
        return
      }
      if (cancelled || requestInFlight) {
        return
      }

      requestInFlight = true
      if (initialLoad) {
        setLoading(true)
      }
      try {
        const result = await getAdminCharges(hallId)
        if (cancelled) {
          return
        }
        if (!result.error) {
          setRows(result.data ?? [])
        }
        setError(result.error)
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Chargement des factures impossible.')
        }
      } finally {
        requestInFlight = false
        if (!cancelled && initialLoad) {
          setLoading(false)
        }
      }
    }

    void load(true)

    const refreshInterval = window.setInterval(() => void load(), REFRESH_INTERVAL_MS)
    const onFocus = () => void load()
    window.addEventListener('focus', onFocus)

    return () => {
      cancelled = true
      window.clearInterval(refreshInterval)
      window.removeEventListener('focus', onFocus)
    }
  }, [hallId])

  return { rows, loading, error, setError }
}
