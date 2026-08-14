import { PageContainer } from '../../../components/layout/PageContainer'
import { Card } from '../../../components/ui/Card'
import { StatusBadge } from '../../../components/ui/StatusBadge'

const stats = [
  { label: 'Commercants', value: '42' },
  { label: 'Stands', value: '58' },
  { label: 'Total metres lineaires', value: '312 ml' },
  { label: 'Frais periode', value: '12 000,00 EUR' },
  { label: 'Total refacture', value: '12 000,00 EUR' },
]

export function AdminDashboardPage() {
  return (
    <PageContainer>
      <div className="space-y-6">
        <Card title="Administration Biltoki" subtitle="Vue globale de la periode active">
          <div className="grid gap-3 md:grid-cols-3">
            {stats.map((item) => (
              <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-xs text-slate-500">{item.label}</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{item.value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2">
            <span className="text-sm text-slate-500">Statut periode:</span>
            <StatusBadge status="calculated" />
          </div>
        </Card>
      </div>
    </PageContainer>
  )
}
