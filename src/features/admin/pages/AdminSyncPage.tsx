import { useState } from 'react'
import { PageContainer } from '../../../components/layout/PageContainer'
import { Card } from '../../../components/ui/Card'
import { StateMessage } from '../../../components/ui/StateMessage'
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

export function AdminSyncPage() {
  const { halls, selectedHallId, setSelectedHallId, loading } = useAdminHall()
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)

  const triggerPennylaneSync = async (mode: 'recent' | 'backfill') => {
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

    const path = mode === 'backfill' ? `/${selectedHallId}/backfill` : `/${selectedHallId}`

    try {
      const response = await fetch(`${backendUrl}/api/sync/pennylane${path}`, {
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
          `${mode === 'backfill' ? 'Backfill' : 'Sync'} ${body.status} : ${body.recordsProcessed} facture(s) traitee(s).${errorDetails}`,
        )
      }
    } catch (err) {
      setSyncMessage(err instanceof Error ? err.message : 'Erreur reseau')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <PageContainer>
      {loading ? <StateMessage variant="loading" title="Chargement..." /> : null}

      {!loading ? (
        <Card title="Synchronisation Pennylane" subtitle="Recupere les factures depuis Pennylane et les range par mois.">
          {syncing ? (
            <div className="mb-4 flex items-center gap-3 rounded-lg border border-[#e1dacd] bg-[#f7e7b8] px-3 py-2 text-sm font-medium text-[#171511]" role="status">
              <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[#d99226] border-t-[#171511]" aria-hidden="true" />
              Synchronisation en cours. Cette operation peut prendre plusieurs minutes pour l'historique complet.
            </div>
          ) : null}
          <div className="grid gap-3 md:grid-cols-3 md:items-end">
            <label className="block text-sm text-[#4d5562]">
              Halle
              <select
                className="brand-input mt-1"
                value={selectedHallId}
                onChange={(event) => setSelectedHallId(event.target.value)}
              >
                {halls.map((hall) => (
                  <option key={hall.id} value={hall.id}>
                    {hall.name}
                  </option>
                ))}
              </select>
            </label>

            <button
              className="brand-button"
              disabled={syncing}
              type="button"
              onClick={() => void triggerPennylaneSync('recent')}
            >
              {syncing ? 'Synchronisation...' : 'Sync mois recents'}
            </button>

            <button
              className="rounded-full border border-[#13223a33] px-4 py-2 text-sm font-semibold text-[#13223a] hover:bg-[#13223a0f] disabled:opacity-50"
              disabled={syncing}
              type="button"
              onClick={() => void triggerPennylaneSync('backfill')}
            >
              {syncing ? 'En cours...' : 'Backfill historique complet'}
            </button>
          </div>
          {syncMessage ? (
            <p className="mt-3 text-sm text-[#4d5562]" aria-live="polite">
              {syncMessage}
            </p>
          ) : null}
        </Card>
      ) : null}
    </PageContainer>
  )
}
