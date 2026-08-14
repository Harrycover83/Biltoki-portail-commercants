import { useEffect, useState } from 'react'
import { Card } from '../../../components/ui/Card'
import { PageContainer } from '../../../components/layout/PageContainer'
import { formatEuroFromCents, formatPercentage } from '../../../lib/money'
import { StateMessage } from '../../../components/ui/StateMessage'
import { getMerchantDashboardSummary } from '../services/merchantService'
import type { MerchantDashboardSummary } from '../../../types/domain'

export function DashboardPage() {
  const [summary, setSummary] = useState<MerchantDashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const result = await getMerchantDashboardSummary()
      setSummary(result.data)
      setError(result.error)
      setLoading(false)
    }

    void load()
  }, [])

  return (
    <PageContainer>
      {loading ? <StateMessage variant="loading" title="Chargement du dashboard..." /> : null}
      {!loading && error ? <StateMessage variant="error" title="Erreur" message={error} /> : null}
      {!loading && !error && !summary ? (
        <StateMessage
          variant="empty"
          title="Aucune donnee disponible"
          message="Ajoutez des frais et lancez un calcul d'allocation pour afficher votre dashboard."
        />
      ) : null}

      {summary ? (
      <div className="space-y-6">
        <Card>
          <p className="text-sm text-slate-500">Bonjour</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">{summary.merchantName}</h1>
          <div className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-3">
            <p>
              Stand : <span className="font-medium">{summary.standName}</span>
            </p>
            <p>
              Numero : <span className="font-medium">{summary.standNumber}</span>
            </p>
            <p>
              Halle : <span className="font-medium">{summary.hallName}</span>
            </p>
          </div>
        </Card>

        <div className="grid gap-4 md:grid-cols-4">
          <Card title="Frais de service">
            <p className="text-2xl font-semibold text-slate-900">{formatEuroFromCents(summary.totalChargesCents)}</p>
          </Card>
          <Card title="Periode">
            <p className="text-lg font-medium text-slate-900">{summary.periodLabel}</p>
          </Card>
          <Card title="Votre quote-part">
            <p className="text-lg font-medium text-slate-900">{formatPercentage(summary.allocationPercentage)}</p>
          </Card>
          <Card title="Metres lineaires">
            <p className="text-lg font-medium text-slate-900">{summary.linearMeters} ml</p>
          </Card>
        </div>
      </div>
      ) : null}
    </PageContainer>
  )
}
