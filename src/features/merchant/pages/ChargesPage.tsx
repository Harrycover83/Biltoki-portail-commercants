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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const historyResult = await getMerchantHistory()
      if (historyResult.error) {
        setError(historyResult.error)
        setLoading(false)
        return
      }

      const latestPeriodId = historyResult.data?.[0]?.periodId
      if (!latestPeriodId) {
        setLoading(false)
        return
      }

      const detailResult = await getMerchantChargePeriodDetail(latestPeriodId)
      setDetail(detailResult.data)
      setError(detailResult.error)
      setLoading(false)
    }

    void load()
  }, [])

  return (
    <PageContainer>
      {loading ? <StateMessage variant="loading" title="Chargement des frais..." /> : null}
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
