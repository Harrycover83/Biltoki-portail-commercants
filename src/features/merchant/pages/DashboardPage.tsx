import { useEffect, useState } from 'react'
import { Card } from '../../../components/ui/Card'
import { PageContainer } from '../../../components/layout/PageContainer'
import { formatEuroFromCents } from '../../../lib/money'
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
          message="Ajoutez des frais communs dans Pennylane pour afficher votre dashboard."
        />
      ) : null}

      {summary ? (
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-end">
              <div>
                <p className="brand-section-title">Bienvenue</p>
                <h1 className="brand-display mt-3 text-[2.55rem] leading-[0.95] font-semibold">{summary.merchantName}</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#4d5562]">
                  Un espace de transparence pour suivre les frais communs de votre halle, classes par periode.
                </p>
              </div>

              <div className="rounded-[1.35rem] border border-[#13223a17] bg-white/70 p-4">
                <div className="grid gap-3 text-sm text-slate-700">
                  <p>
                    Halle : <span className="font-semibold text-[#13223a]">{summary.hallName}</span>
                  </p>
                </div>
              </div>
            </div>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card title="Frais de service">
              <p className="text-3xl font-semibold text-[#13223a]">{formatEuroFromCents(summary.totalChargesCents)}</p>
            </Card>
            <Card title="Periode">
              <p className="text-lg font-semibold text-[#13223a]">{summary.periodLabel}</p>
            </Card>
            <Card title="Nombre de postes">
              <p className="text-lg font-semibold text-[#13223a]">{summary.lineCount}</p>
            </Card>
          </div>
        </div>
      ) : null}
    </PageContainer>
  )
}
