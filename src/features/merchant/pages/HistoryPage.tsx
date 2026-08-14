import { Link } from 'react-router-dom'
import { Card } from '../../../components/ui/Card'
import { PageContainer } from '../../../components/layout/PageContainer'
import { formatEuroFromCents } from '../../../lib/money'

const history = [
  { id: 'juillet-2026', label: 'Juillet 2026', amount: 124560 },
  { id: 'juin-2026', label: 'Juin 2026', amount: 118000 },
  { id: 'mai-2026', label: 'Mai 2026', amount: 121000 },
  { id: 'avril-2026', label: 'Avril 2026', amount: 116540 },
]

export function HistoryPage() {
  return (
    <PageContainer>
      <Card title="Historique des frais">
        <ul className="divide-y divide-slate-100">
          {history.map((row) => (
            <li key={row.id} className="flex items-center justify-between py-3">
              <Link to={`/frais/${row.id}`} className="font-medium text-slate-800 hover:underline">
                {row.label}
              </Link>
              <span className="text-slate-700">{formatEuroFromCents(row.amount)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </PageContainer>
  )
}
