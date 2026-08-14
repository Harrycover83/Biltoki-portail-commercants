import { PageContainer } from '../../../components/layout/PageContainer'
import { Card } from '../../../components/ui/Card'

export function AdminAllocationsPage() {
  return (
    <PageContainer>
      <Card title="Repartitions" subtitle="Resultats des calculs par commerçant.">
        <p className="text-sm text-slate-600">V1: visualisation des allocations snapshottees.</p>
      </Card>
    </PageContainer>
  )
}
