import { Card } from '../../../components/ui/Card'
import { PageContainer } from '../../../components/layout/PageContainer'
import { useAuth } from '../../auth/AuthProvider'

export function ProfilePage() {
  const { user, profile } = useAuth()

  return (
    <PageContainer>
      <Card title="Profil">
        <dl className="grid gap-3 text-sm text-slate-700 md:grid-cols-2">
          <div>
            <dt className="text-slate-500">Email</dt>
            <dd className="font-medium text-slate-900">{profile?.email ?? user?.email ?? 'N/A'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Role</dt>
            <dd className="font-medium text-slate-900">{profile?.role ?? 'N/A'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Prenom</dt>
            <dd className="font-medium text-slate-900">{profile?.first_name ?? 'N/A'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Nom</dt>
            <dd className="font-medium text-slate-900">{profile?.last_name ?? 'N/A'}</dd>
          </div>
        </dl>
      </Card>
    </PageContainer>
  )
}
