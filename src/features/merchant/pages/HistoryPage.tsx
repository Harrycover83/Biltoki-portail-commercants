import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../../../components/ui/Card'
import { PageContainer } from '../../../components/layout/PageContainer'
import { formatEuroFromCents } from '../../../lib/money'
import { StateMessage } from '../../../components/ui/StateMessage'
import { getMerchantHallOptions, getMerchantHistory } from '../services/merchantService'
import type { MerchantHallOption, MerchantHistoryRow } from '../../../types/domain'

export function HistoryPage() {
  const [halls, setHalls] = useState<MerchantHallOption[]>([])
  const [selectedHallId, setSelectedHallId] = useState('')
  const [history, setHistory] = useState<MerchantHistoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadHalls = async () => {
      const hallsResult = await getMerchantHallOptions()
      if (hallsResult.error) {
        setError(hallsResult.error)
        setLoading(false)
        return
      }

      const options = hallsResult.data ?? []
      setHalls(options)
      setSelectedHallId(options[0]?.hallId ?? '')
      setLoading(false)
    }

    void loadHalls()
  }, [])

  useEffect(() => {
    const loadHistory = async () => {
      if (!selectedHallId) {
        setHistory([])
        return
      }

      setLoading(true)
      const result = await getMerchantHistory(selectedHallId)
      setHistory(result.data ?? [])
      setError(result.error)
      setLoading(false)
    }

    void loadHistory()
  }, [selectedHallId])

  return (
    <PageContainer>
      {loading ? <StateMessage variant="loading" title="Chargement de l'historique..." /> : null}
      {!loading && error ? <StateMessage variant="error" title="Erreur" message={error} /> : null}
      {!loading && !error && history.length === 0 ? (
        <StateMessage variant="empty" title="Historique vide" message="Aucune periode de frais disponible pour le moment." />
      ) : null}

      {history.length > 0 ? (
        <Card title="Historique des frais">
          {halls.length > 1 ? (
            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-[#4d5562]" htmlFor="history-hall-select">
                Halle
              </label>
              <select
                id="history-hall-select"
                value={selectedHallId}
                onChange={(event) => setSelectedHallId(event.target.value)}
                className="brand-input max-w-sm"
              >
                {halls.map((hall) => (
                  <option key={hall.hallId} value={hall.hallId}>
                    {hall.hallName}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

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
