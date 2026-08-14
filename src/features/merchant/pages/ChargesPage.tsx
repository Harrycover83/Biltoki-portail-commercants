import { Link } from 'react-router-dom'
import { PageContainer } from '../../../components/layout/PageContainer'
import { Card } from '../../../components/ui/Card'
import { formatEuroFromCents } from '../../../lib/money'
import { sampleCharges, sampleSummary } from '../mockData'

export function ChargesPage() {
  return (
    <PageContainer>
      <Card title="Detail des frais" subtitle={`Periode ${sampleSummary.periodLabel}`}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2">Poste</th>
                <th className="py-2 text-right">Total</th>
                <th className="py-2 text-right">Votre part</th>
              </tr>
            </thead>
            <tbody>
              {sampleCharges.map((line) => (
                <tr key={line.id} className="border-b border-slate-100">
                  <td className="py-2">{line.label}</td>
                  <td className="py-2 text-right">{formatEuroFromCents(line.totalCents)}</td>
                  <td className="py-2 text-right font-medium text-slate-900">{formatEuroFromCents(line.allocatedCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm text-slate-600">
          Voir le calcul complet pour cette periode dans <Link className="underline" to="/frais/period-juillet-2026">la page de detail</Link>.
        </p>
      </Card>
    </PageContainer>
  )
}
