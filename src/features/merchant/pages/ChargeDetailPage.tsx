import { useParams } from 'react-router-dom'
import { Card } from '../../../components/ui/Card'
import { PageContainer } from '../../../components/layout/PageContainer'
import { formatEuroFromCents, formatPercentage } from '../../../lib/money'
import { sampleSummary } from '../mockData'

export function ChargeDetailPage() {
  const { periodId } = useParams()

  return (
    <PageContainer>
      <Card title="Explication du calcul" subtitle={`Periode: ${sampleSummary.periodLabel} (${periodId})`}>
        <div className="space-y-2 text-sm text-slate-700">
          <p>Total des frais concernes : {formatEuroFromCents(1200000)}</p>
          <p>Total metres lineaires : {sampleSummary.totalLinearMeters} ml</p>
          <p>Votre stand : {sampleSummary.linearMeters} ml</p>
          <p>
            Quote-part: {sampleSummary.linearMeters} / {sampleSummary.totalLinearMeters} ={' '}
            {formatPercentage(sampleSummary.allocationPercentage)}
          </p>
          <p>
            Montant: {formatEuroFromCents(1200000)} x {formatPercentage(sampleSummary.allocationPercentage)} ={' '}
            {formatEuroFromCents(150000)}
          </p>
        </div>
      </Card>
    </PageContainer>
  )
}
