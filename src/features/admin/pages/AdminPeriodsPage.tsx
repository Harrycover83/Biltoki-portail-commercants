import { PageContainer } from '../../../components/layout/PageContainer'
import { Card } from '../../../components/ui/Card'

export function AdminPeriodsPage() {
  return (
    <PageContainer>
      <Card title="Periodes" subtitle="Draft, calculated, validated, closed.">
        <p className="text-sm text-slate-600">V1: gestion des periodes et cloture a brancher via fonction SQL securisee.</p>
      </Card>
    </PageContainer>
  )
}
