import { useState } from 'react'
import { getSupabaseClient } from '../../../lib/supabase'
import { getBackendUrl } from '../../../lib/env'
import { useAdminHall } from '../AdminHallContext'

function formatSyncErrors(errors: unknown): string {
  if (!Array.isArray(errors)) {
    return ''
  }

  return errors
    .map((error) => {
      if (typeof error === 'string') {
        return error
      }
      if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
        return error.message
      }
      return JSON.stringify(error)
    })
    .filter(Boolean)
    .join(' ')
}

export function PennylaneSyncPanel() {
  const { selectedHallId, notifySynced } = useAdminHall()
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)

  // Synchronisation complete et idempotente : le backend met a jour par pennylane_id, sans doublon.
  const triggerPennylaneSync = async () => {
    const backendUrl = getBackendUrl()
    if (!backendUrl) {
      setSyncMessage('VITE_BACKEND_URL non configure.')
      return
    }
    if (!selectedHallId) {
      setSyncMessage('Selectionnez une halle.')
      return
    }

    const client = getSupabaseClient()
    const {
      data: { session },
    } = (await client?.auth.getSession()) ?? { data: { session: null } }

    if (!session?.access_token) {
      setSyncMessage('Session admin introuvable, reconnectez-vous.')
      return
    }

    setSyncing(true)
    setSyncMessage(null)

    try {
      const response = await fetch(`${backendUrl}/api/sync/pennylane/${selectedHallId}/backfill`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const body = await response.json()

      if (!response.ok) {
        setSyncMessage(body.error ?? `Echec (HTTP ${response.status})`)
      } else {
        const formattedErrors = formatSyncErrors(body.errors)
        const errorDetails = formattedErrors ? ` ${formattedErrors}` : ''
        setSyncMessage(
          `Synchronisation ${body.status} : ${body.recordsProcessed} facture(s) traitee(s).${errorDetails}`,
        )
        notifySynced()
      }
    } catch (err) {
      setSyncMessage(err instanceof Error ? err.message : 'Erreur reseau')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="flex min-w-0 items-center gap-3 text-xs font-medium text-[#171511]">
      {syncing ? (
        <span className="flex items-center gap-2" role="status">
          <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-[#d99226] border-t-[#171511]" aria-hidden="true" />
          Synchronisation en cours...
        </span>
      ) : syncMessage ? (
        <span className="truncate" title={syncMessage} aria-live="polite">
          {syncMessage}
        </span>
      ) : null}
      <button
        className="shrink-0 rounded-full border border-[#d6cebf] bg-[#fffcf6] px-4 py-2 text-sm font-semibold text-[#171511] shadow-sm hover:bg-white disabled:opacity-50"
        disabled={syncing}
        type="button"
        onClick={() => void triggerPennylaneSync()}
      >
        Synchroniser Pennylane
      </button>
    </div>
  )
}
