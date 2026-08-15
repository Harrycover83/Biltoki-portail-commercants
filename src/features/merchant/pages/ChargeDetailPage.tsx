import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Card } from '../../../components/ui/Card'
import { PageContainer } from '../../../components/layout/PageContainer'
import { formatEuroFromCents } from '../../../lib/money'
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
        <StateMessage variant="empty" title="Periode introuvable" message="Aucun frais n'a ete trouve pour cette periode." />
      ) : null}

      {detail ? (
      <Card title="Detail de la periode" subtitle={`Periode: ${detail.periodLabel} (${detail.periodId})`}>
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
                  <td className="py-3 text-right font-semibold text-[#13223a]">
                    {formatEuroFromCents(line.totalCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-right text-sm font-semibold text-[#13223a]">
          Total periode: {formatEuroFromCents(detail.totalChargesCents)}
        </p>
      </Card>
      ) : null}
    </PageContainer>
  )
}
