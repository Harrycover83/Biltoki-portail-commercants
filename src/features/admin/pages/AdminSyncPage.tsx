import { PageContainer } from '../../../components/layout/PageContainer'
import { Card } from '../../../components/ui/Card'

export function AdminSyncPage() {
  return (
    <PageContainer>
      <Card title="Synchronisation Pennylane" subtitle="Lancement manuel et historique des erreurs.">
        <p className="text-sm text-slate-600">V1: endpoint Edge Function a brancher. Les cles restent exclusivement cote serveur.</p>
      </Card>
    </PageContainer>
  )
}
