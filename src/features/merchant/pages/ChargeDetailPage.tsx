import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Card } from '../../../components/ui/Card'
import { PageContainer } from '../../../components/layout/PageContainer'
import { formatEuroFromCents, formatPercentage } from '../../../lib/money'
import { StateMessage } from '../../../components/ui/StateMessage'
import { getMerchantChargePeriodDetail } from '../services/merchantService'
import type { MerchantChargePeriodDetail } from '../../../types/domain'

export function ChargeDetailPage() {
  const { periodId } = useParams()
  const [detail, setDetail] = useState<MerchantChargePeriodDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      if (!periodId) {
        setError('Periode invalide.')
        setLoading(false)
        return
      }

      const result = await getMerchantChargePeriodDetail(periodId)
      setDetail(result.data)
      setError(result.error)
      setLoading(false)
    }

    void load()
  }, [periodId])

  return (
    <PageContainer>
      {loading ? <StateMessage variant="loading" title="Chargement du detail..." /> : null}
      {!loading && error ? <StateMessage variant="error" title="Erreur" message={error} /> : null}
      {!loading && !error && !detail ? (
        <StateMessage variant="empty" title="Periode introuvable" message="Aucune allocation n'a ete trouvee pour cette periode." />
      ) : null}

      {detail ? (
      <Card title="Explication du calcul" subtitle={`Periode: ${detail.periodLabel} (${detail.periodId})`}>
        <div className="space-y-2 text-sm text-slate-700">
          <p>Total des frais concernes : {formatEuroFromCents(detail.totalCommonChargesCents)}</p>
          <p>Total metres lineaires : {detail.totalLinearMeters} ml</p>
          <p>Votre stand : {detail.linearMeters} ml</p>
          <p>
            Quote-part: {detail.linearMeters} / {detail.totalLinearMeters} ={' '}
            {formatPercentage(detail.allocationPercentage)}
          </p>
          <p>
            Montant: {formatEuroFromCents(detail.totalCommonChargesCents)} x {formatPercentage(detail.allocationPercentage)} ={' '}
            {formatEuroFromCents(detail.totalAllocatedCents)}
          </p>
        </div>
      </Card>
      ) : null}
    </PageContainer>
  )
}
