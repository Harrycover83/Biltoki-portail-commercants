import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getSupabaseClient } from '../../lib/supabase'

export type AdminHallOption = {
  id: string
  name: string
}

type AdminHallContextValue = {
  halls: AdminHallOption[]
  selectedHallId: string
  setSelectedHallId: (hallId: string) => void
  loading: boolean
}

const STORAGE_KEY = 'biltoki-admin-selected-hall'
const AdminHallContext = createContext<AdminHallContextValue | undefined>(undefined)

export function AdminHallProvider({ children }: { children: ReactNode }) {
  const [halls, setHalls] = useState<AdminHallOption[]>([])
  const [selectedHallId, setSelectedHallId] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadHalls = async () => {
      const client = getSupabaseClient()
      if (!client) {
        setLoading(false)
        return
      }

      const { data, error } = await client.from('halls').select('id, name').order('name', { ascending: true })

      if (error) {
        setLoading(false)
        return
      }

      const hallOptions = (data ?? []) as AdminHallOption[]
      setHalls(hallOptions)

      const storedHallId = window.localStorage.getItem(STORAGE_KEY)
      const initialHallId = hallOptions.some((hall) => hall.id === storedHallId)
        ? storedHallId!
        : hallOptions[0]?.id ?? 'all'

      setSelectedHallId(initialHallId)
      setLoading(false)
    }

    void loadHalls()
  }, [])

  useEffect(() => {
    if (selectedHallId) {
      window.localStorage.setItem(STORAGE_KEY, selectedHallId)
    }
  }, [selectedHallId])

  const value = useMemo<AdminHallContextValue>(
    () => ({
      halls,
      selectedHallId,
      setSelectedHallId,
      loading,
    }),
    [halls, loading, selectedHallId],
  )

  return <AdminHallContext.Provider value={value}>{children}</AdminHallContext.Provider>
}

export function useAdminHall(): AdminHallContextValue {
  const context = useContext(AdminHallContext)
  if (!context) {
    throw new Error('useAdminHall must be used within AdminHallProvider')
  }

  return context
}
