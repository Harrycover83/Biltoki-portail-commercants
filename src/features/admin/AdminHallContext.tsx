import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '@/features/auth/AuthProvider'
import { hallStorageKey, pickInitialHallId, scopeHalls } from '@/features/admin/hallScope'
import { isHallScopedRole } from '@/lib/roles'
import { getSupabaseClient } from '@/lib/supabase'

export type AdminHallOption = {
  id: string
  name: string
}

type AdminHallContextValue = {
  halls: AdminHallOption[]
  selectedHallId: string
  setSelectedHallId: (hallId: string) => void
  loading: boolean
  syncVersion: number
  notifySynced: () => void
}

const AdminHallContext = createContext<AdminHallContextValue | undefined>(undefined)

export function AdminHallProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const userId = profile?.id ?? null
  const role = profile?.role ?? null
  const [halls, setHalls] = useState<AdminHallOption[]>([])
  const [selectedHallId, setSelectedHallIdState] = useState('')
  const [loading, setLoading] = useState(true)
  const [syncVersion, setSyncVersion] = useState(0)
  const notifySynced = useCallback(() => setSyncVersion((version) => version + 1), [])

  useEffect(() => {
    let cancelled = false

    const loadHalls = async () => {
      const client = getSupabaseClient()
      if (!client || !userId) {
        setLoading(false)
        return
      }

      const { data, error } = await client.from('halls').select('id, name').order('name', { ascending: true })
      if (cancelled) return
      if (error) {
        setLoading(false)
        return
      }

      let permittedHallIds: string[] | null = null
      if (isHallScopedRole(role)) {
        const { data: permissions, error: permissionError } = await client
          .from('admin_hall_permissions')
          .select('hall_id')
          .eq('profile_id', userId)
        if (cancelled) return
        // An empty answer is treated as "unreadable": the policy-filtered list stays authoritative.
        if (!permissionError && permissions && permissions.length > 0) {
          permittedHallIds = permissions.map((permission) => permission.hall_id as string)
        }
      }

      const hallOptions = scopeHalls(role, (data ?? []) as AdminHallOption[], permittedHallIds)
      setHalls(hallOptions)
      setSelectedHallIdState(pickInitialHallId(hallOptions, window.localStorage.getItem(hallStorageKey(userId))))
      setLoading(false)
    }

    void loadHalls()
    return () => {
      cancelled = true
    }
  }, [role, userId])

  const setSelectedHallId = useCallback(
    (hallId: string) => {
      if (!halls.some((hall) => hall.id === hallId)) return
      setSelectedHallIdState(hallId)
      if (userId) window.localStorage.setItem(hallStorageKey(userId), hallId)
    },
    [halls, userId],
  )

  const value = useMemo<AdminHallContextValue>(
    () => ({
      halls,
      selectedHallId,
      setSelectedHallId,
      loading,
      syncVersion,
      notifySynced,
    }),
    [halls, loading, notifySynced, selectedHallId, setSelectedHallId, syncVersion],
  )

  return <AdminHallContext.Provider value={value}>{children}</AdminHallContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAdminHall(): AdminHallContextValue {
  const context = useContext(AdminHallContext)
  if (!context) {
    throw new Error('useAdminHall must be used within AdminHallProvider')
  }

  return context
}
