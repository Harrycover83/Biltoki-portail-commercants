import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageContainer } from '../../../components/layout/PageContainer'
import { Card } from '../../../components/ui/Card'
import { formatEuroFromCents } from '../../../lib/money'
import { StateMessage } from '../../../components/ui/StateMessage'
import { getMerchantChargePeriodDetail, getMerchantHistory } from '../services/merchantService'
import type { MerchantChargePeriodDetail } from '../../../types/domain'

export function ChargesPage() {
  const [detail, setDetail] = useState<MerchantChargePeriodDetail | null>(null)
  const [history, setHistory] = useState<Array<{ periodId: string; periodLabel: string }>>([])
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const historyResult = await getMerchantHistory()
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

      const detailResult = await getMerchantChargePeriodDetail(latestPeriodId)
      setDetail(detailResult.data)
      setError(detailResult.error)
      setLoading(false)
    }

    void load()
  }, [])

  useEffect(() => {
    const loadDetail = async () => {
      if (!selectedPeriodId) {
        return
      }

      setLoadingDetail(true)
      const detailResult = await getMerchantChargePeriodDetail(selectedPeriodId)
      setDetail(detailResult.data)
      setError(detailResult.error)
      setLoadingDetail(false)
    }

    if (!loading) {
      void loadDetail()
    }
  }, [loading, selectedPeriodId])

  return (
    <PageContainer>
      {loading || loadingDetail ? <StateMessage variant="loading" title="Chargement des frais..." /> : null}
      {!loading && error ? <StateMessage variant="error" title="Erreur" message={error} /> : null}
      {!loading && !error && !detail ? (
        <StateMessage
          variant="empty"
          title="Aucun frais a afficher"
          message="Aucune allocation n'est disponible pour votre compte."
        />
      ) : null}

      {detail ? (
        <Card title="Detail des frais" subtitle={`Periode ${detail.periodLabel}`}>
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
                  <th className="py-2 text-right">Total</th>
                  <th className="py-2 text-right">Votre part</th>
                </tr>
              </thead>
              <tbody>
                {detail.lines.map((line) => (
                  <tr key={line.id} className="border-b border-slate-100/80 last:border-b-0">
                    <td className="py-3">{line.label}</td>
                    <td className="py-3 text-right">{formatEuroFromCents(line.totalCents)}</td>
                    <td className="py-3 text-right font-semibold text-[#13223a]">{formatEuroFromCents(line.allocatedCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm text-[#4d5562]">
            Voir le calcul complet pour cette periode dans{' '}
            <Link className="font-semibold text-[#13223a] underline underline-offset-2" to={`/frais/${detail.periodId}`}>
              la page de detail
            </Link>
            .
          </p>
        </Card>
      ) : null}
    </PageContainer>
  )
}
