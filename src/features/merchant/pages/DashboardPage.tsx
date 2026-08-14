import { Card } from '../../../components/ui/Card'
import { PageContainer } from '../../../components/layout/PageContainer'
import { formatEuroFromCents, formatPercentage } from '../../../lib/money'
import { sampleSummary } from '../mockData'

export function DashboardPage() {
  return (
    <PageContainer>
      <div className="space-y-6">
        <Card>
          <p className="text-sm text-slate-500">Bonjour</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">{sampleSummary.merchantName}</h1>
          <div className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-3">
            <p>
              Stand : <span className="font-medium">{sampleSummary.standName}</span>
            </p>
            <p>
              Numero : <span className="font-medium">{sampleSummary.standNumber}</span>
            </p>
            <p>
              Halle : <span className="font-medium">{sampleSummary.hallName}</span>
            </p>
          </div>
        </Card>

        <div className="grid gap-4 md:grid-cols-4">
          <Card title="Frais de service">
            <p className="text-2xl font-semibold text-slate-900">{formatEuroFromCents(sampleSummary.totalChargesCents)}</p>
          </Card>
          <Card title="Periode">
            <p className="text-lg font-medium text-slate-900">{sampleSummary.periodLabel}</p>
          </Card>
          <Card title="Votre quote-part">
            <p className="text-lg font-medium text-slate-900">{formatPercentage(sampleSummary.allocationPercentage)}</p>
          </Card>
          <Card title="Metres lineaires">
            <p className="text-lg font-medium text-slate-900">{sampleSummary.linearMeters} ml</p>
          </Card>
        </div>
      </div>
    </PageContainer>
  )
}
