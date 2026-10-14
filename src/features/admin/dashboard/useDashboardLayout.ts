import { useCallback, useEffect, useMemo, useState } from 'react'
import { normalizeLayout, type WidgetPreference } from '@/features/admin/dashboard/widgets'
import { getSupabaseClient } from '@/lib/supabase'
import type { UserRole } from '@/types/domain'

const storageKey = (userId: string) => `biltoki-dashboard-layout:${userId}`

function readLocal(userId: string | null): unknown {
  if (!userId) return null
  try {
    return JSON.parse(window.localStorage.getItem(storageKey(userId)) ?? 'null')
  } catch {
    return null
  }
}

/**
 * Per-account dashboard layout. The database copy (dashboard_preferences) follows the user across devices;
 * the local copy keeps the dashboard instant and usable when the table is unreachable.
 */
export function useDashboardLayout(userId: string | null, role: UserRole | null | undefined) {
  const [stored, setStored] = useState<unknown>(() => readLocal(userId))
  const layout = useMemo(() => normalizeLayout(stored, role), [stored, role])

  useEffect(() => {
    const client = getSupabaseClient()
    if (!client || !userId) return
    let cancelled = false

    const load = async () => {
      const { data, error } = await client
        .from('dashboard_preferences')
        .select('widgets')
        .eq('profile_id', userId)
        .maybeSingle()
      if (cancelled || error || !data) return
      setStored(data.widgets)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [userId])

  const save = useCallback(
    (next: WidgetPreference[]) => {
      setStored(next)
      if (!userId) return
      try {
        window.localStorage.setItem(storageKey(userId), JSON.stringify(next))
      } catch {
        // Storage can be unavailable (private mode); the in-memory layout still applies.
      }
      const client = getSupabaseClient()
      if (client) {
        // The builder only runs once awaited, hence the explicit then(); a failed save keeps the local copy.
        client
          .from('dashboard_preferences')
          .upsert({ profile_id: userId, widgets: next, updated_at: new Date().toISOString() }, { onConflict: 'profile_id' })
          .then(
            () => undefined,
            () => undefined,
          )
      }
    },
    [userId],
  )

  const reset = useCallback(() => save(normalizeLayout(null, role)), [role, save])

  return { layout, save, reset }
}
