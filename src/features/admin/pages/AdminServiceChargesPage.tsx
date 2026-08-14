import { PageContainer } from '../../../components/layout/PageContainer'
import { Card } from '../../../components/ui/Card'

export function AdminServiceChargesPage() {
  return (
    <PageContainer>
      <Card title="Frais de service" subtitle="Liste des frais communs importes ou saisis.">
        <p className="text-sm text-slate-600">V1: ecran de suivi des frais et categories.</p>
      </Card>
    </PageContainer>
  )
}
