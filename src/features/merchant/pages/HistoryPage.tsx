import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../../../components/ui/Card'
import { PageContainer } from '../../../components/layout/PageContainer'
import { formatEuroFromCents } from '../../../lib/money'
import { StateMessage } from '../../../components/ui/StateMessage'
import { getMerchantHistory } from '../services/merchantService'
import type { MerchantHistoryRow } from '../../../types/domain'

export function HistoryPage() {
  const [history, setHistory] = useState<MerchantHistoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const result = await getMerchantHistory()
      setHistory(result.data ?? [])
      setError(result.error)
      setLoading(false)
    }

    void load()
  }, [])

  return (
    <PageContainer>
      {loading ? <StateMessage variant="loading" title="Chargement de l'historique..." /> : null}
      {!loading && error ? <StateMessage variant="error" title="Erreur" message={error} /> : null}
      {!loading && !error && history.length === 0 ? (
        <StateMessage variant="empty" title="Historique vide" message="Aucune periode de frais disponible pour le moment." />
      ) : null}

      {history.length > 0 ? (
        <Card title="Historique des frais">
          <ul className="divide-y divide-[#13223a14]">
            {history.map((row) => (
              <li key={row.periodId} className="flex items-center justify-between py-4">
                <Link to={`/frais/${row.periodId}`} className="font-medium text-[#13223a] hover:underline underline-offset-2">
                  {row.periodLabel}
                </Link>
                <span className="text-sm font-semibold text-[#4d5562]">{formatEuroFromCents(row.totalChargesCents)}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </PageContainer>
  )
}
