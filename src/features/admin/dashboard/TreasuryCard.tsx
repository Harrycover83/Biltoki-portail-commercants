import { useEffect, useState } from 'react'
import { fetchTreasury, type Treasury } from '@/features/admin/dashboard/treasury'
import { formatDateTime } from '@/lib/format'
import { formatEuroFromCents } from '@/lib/money'

type Loaded = { key: string; treasury?: Treasury; error?: string }

export function TreasuryCard({ hall, loading }: { hall: { id: string } | undefined; loading: boolean }) {
  const [refresh, setRefresh] = useState(0)
  const [result, setResult] = useState<Loaded | null>(null)
  const hallId = hall?.id
  const key = `${hallId}:${refresh}`

  useEffect(() => {
    if (!hallId) return
    const controller = new AbortController()
    fetchTreasury(hallId, controller.signal, refresh > 0).then(
      (treasury) => { if (!controller.signal.aborted) setResult({ key, treasury }) },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setResult({ key, error: error instanceof Error ? error.message : 'Impossible de charger les données Pennylane.' })
        }
      },
    )
    return () => controller.abort()
  }, [hallId, key, refresh])

  // Data of a previous hall never lingers while the new one loads.
  const loaded = result?.key === key ? result : null

  if (loading) return <p role="status">Chargement des halles…</p>
  if (!hall) return <p role="alert">Aucune halle accessible sélectionnée.</p>
  if (!loaded) return <p role="status">Chargement des données Pennylane…</p>
  if (loaded.error || !loaded.treasury) {
    return <p role="alert" className="border border-[#d84d2c] bg-[#fdeee9] p-3">{loaded.error}</p>
  }

  const { proAccount } = loaded.treasury

  return (
    <div className="treasury-tile">
      <div className="treasury-tile__head">
        <span className="treasury-tile__label">Solde du compte pro</span>
        <button
          type="button"
          onClick={() => setRefresh((version) => version + 1)}
          className="treasury-tile__refresh"
          aria-label="Actualiser le solde"
          title="Actualiser"
        >
          ↻
        </button>
      </div>
      <div className="treasury-tile__amount">
        {proAccount ? formatEuroFromCents(proAccount.balanceCents) : 'Indisponible'}
      </div>
      <div className="treasury-tile__foot">
        {proAccount
          ? `Pennylane · mis à jour le ${formatDateTime(proAccount.updatedAt)}`
          : 'Compte pro introuvable dans Pennylane'}
      </div>
    </div>
  )
}
