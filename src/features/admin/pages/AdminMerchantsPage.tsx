import { PageContainer } from '../../../components/layout/PageContainer'
import { Card } from '../../../components/ui/Card'

export function AdminMerchantsPage() {
  return (
    <PageContainer>
      <Card title="Commercants" subtitle="Recherche, filtres et activation/desactivation a connecter sur Supabase.">
        <p className="text-sm text-slate-600">V1: ecran de base en place, donnees a brancher avec policies RLS admin.</p>
      </Card>
    </PageContainer>
  )
}
