import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageContainer } from '../../../components/layout/PageContainer'
import { Card } from '../../../components/ui/Card'
import { formatEuroFromCents } from '../../../lib/money'
import { StateMessage } from '../../../components/ui/StateMessage'
import { getMerchantChargePeriodDetail, getMerchantHallOptions, getMerchantHistory } from '../services/merchantService'
import type { MerchantChargePeriodDetail, MerchantHallOption } from '../../../types/domain'

export function ChargesPage() {
  const [halls, setHalls] = useState<MerchantHallOption[]>([])
  const [selectedHallId, setSelectedHallId] = useState<string>('')
  const [detail, setDetail] = useState<MerchantChargePeriodDetail | null>(null)
  const [history, setHistory] = useState<Array<{ periodId: string; periodLabel: string }>>([])
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadHallsAndHistory = async () => {
      const hallsResult = await getMerchantHallOptions()
      if (hallsResult.error) {
        setError(hallsResult.error)
        setLoading(false)
        return
      }

      const hallOptions = hallsResult.data ?? []
      setHalls(hallOptions)
      const initialHallId = hallOptions[0]?.hallId ?? ''
      setSelectedHallId(initialHallId)

      if (!initialHallId) {
        setLoading(false)
        return
      }

      const historyResult = await getMerchantHistory(initialHallId)
      if (historyResult.error) {
        setError(historyResult.error)
        setLoading(false)
        return
      }

      const periods = (historyResult.data ?? []).map((row) => ({
        periodId: row.periodId,
        periodLabel: row.periodLabel,
      }))

      setHistory(periods)

      const latestPeriodId = periods[0]?.periodId
      if (!latestPeriodId) {
        setLoading(false)
        return
      }

      setSelectedPeriodId(latestPeriodId)

      const detailResult = await getMerchantChargePeriodDetail(latestPeriodId, initialHallId)
      setDetail(detailResult.data)
      setError(detailResult.error)
      setLoading(false)
    }

    void loadHallsAndHistory()
  }, [])

  useEffect(() => {
    const loadHistoryForHall = async () => {
      if (!selectedHallId) {
        setHistory([])
        setSelectedPeriodId('')
        setDetail(null)
        return
      }

      setLoadingDetail(true)
      const historyResult = await getMerchantHistory(selectedHallId)
      if (historyResult.error) {
        setError(historyResult.error)
        setLoadingDetail(false)
        return
      }

      const periods = (historyResult.data ?? []).map((row) => ({
        periodId: row.periodId,
        periodLabel: row.periodLabel,
      }))

      setHistory(periods)
      const nextPeriodId = periods[0]?.periodId ?? ''
      setSelectedPeriodId(nextPeriodId)

      if (!nextPeriodId) {
        setDetail(null)
        setLoadingDetail(false)
        return
      }

      const detailResult = await getMerchantChargePeriodDetail(nextPeriodId, selectedHallId)
      setDetail(detailResult.data)
      setError(detailResult.error)
      setLoadingDetail(false)
    }

    if (!loading) {
      void loadHistoryForHall()
    }
  }, [loading, selectedHallId])

  useEffect(() => {
    const loadDetail = async () => {
      if (!selectedPeriodId || !selectedHallId) {
        return
      }

      setLoadingDetail(true)
      const detailResult = await getMerchantChargePeriodDetail(selectedPeriodId, selectedHallId)
      setDetail(detailResult.data)
      setError(detailResult.error)
      setLoadingDetail(false)
    }

    if (!loading) {
      void loadDetail()
    }
  }, [loading, selectedHallId, selectedPeriodId])

  return (
    <PageContainer>
      {loading || loadingDetail ? <StateMessage variant="loading" title="Chargement des frais..." /> : null}
      {!loading && error ? <StateMessage variant="error" title="Erreur" message={error} /> : null}
      {!loading && !error && !detail ? (
        <StateMessage
          variant="empty"
          title="Aucun frais a afficher"
          message="Aucun frais commun n'est disponible pour votre halle."
        />
      ) : null}

      {detail ? (
        <Card title="Detail des frais" subtitle={`Periode ${detail.periodLabel}`}>
          {halls.length > 1 ? (
            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-[#4d5562]" htmlFor="charges-hall-select">
                Halle
              </label>
              <select
                id="charges-hall-select"
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

          {history.length > 0 ? (
            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-[#4d5562]" htmlFor="charges-period-select">
                Mois a consulter
              </label>
              <select
                id="charges-period-select"
                value={selectedPeriodId}
                onChange={(event) => setSelectedPeriodId(event.target.value)}
                className="brand-input max-w-sm"
              >
                {history.map((period) => (
                  <option key={period.periodId} value={period.periodId}>
                    {period.periodLabel}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#13223a1f] text-[#626a78]">
                  <th className="py-2">Poste</th>
                  <th className="py-2">Categorie</th>
                  <th className="py-2 text-right">Montant TTC</th>
                </tr>
              </thead>
              <tbody>
                {detail.lines.map((line) => (
                  <tr key={line.id} className="border-b border-slate-100/80 last:border-b-0">
                    <td className="py-3">{line.label}</td>
                    <td className="py-3">{line.category ?? '-'}</td>
                    <td className="py-3 text-right font-semibold text-[#13223a]">{formatEuroFromCents(line.totalCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm">
            <p className="text-[#4d5562]">Vue de transparence des frais communs saisis dans Pennylane.</p>
            <Link className="font-semibold text-[#13223a] underline underline-offset-2" to={`/frais/${detail.periodId}`}>
              Voir la synthese
            </Link>
          </div>
        </Card>
      ) : null}
    </PageContainer>
  )
}
