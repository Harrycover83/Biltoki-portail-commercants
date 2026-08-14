import { PageContainer } from '../../../components/layout/PageContainer'
import { Card } from '../../../components/ui/Card'

export function AdminStandsPage() {
  return (
    <PageContainer>
      <Card title="Stands" subtitle="Gestion des stands, metres lineaires et historique.">
        <p className="text-sm text-slate-600">V1: structure prete pour CRUD admin.</p>
      </Card>
    </PageContainer>
  )
}
