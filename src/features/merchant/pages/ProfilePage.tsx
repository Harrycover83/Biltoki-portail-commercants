import { Card } from '../../../components/ui/Card'
import { PageContainer } from '../../../components/layout/PageContainer'
import { useAuth } from '../../auth/AuthProvider'

export function ProfilePage() {
  const { user, profile } = useAuth()

  return (
    <PageContainer>
      <Card title="Profil">
        <dl className="grid gap-3 text-sm text-[#15130f] md:grid-cols-2">
          <div className="border-b-2 border-[#15130f] pb-3">
            <dt className="text-xs font-bold uppercase tracking-wide text-[#615b51]">Email</dt>
            <dd className="mt-1 font-semibold">{profile?.email ?? user?.email ?? 'N/A'}</dd>
          </div>
          <div className="border-b-2 border-[#15130f] pb-3">
            <dt className="text-xs font-bold uppercase tracking-wide text-[#615b51]">Role</dt>
            <dd className="mt-1 font-semibold">{profile?.role ?? 'N/A'}</dd>
          </div>
          <div className="border-b-2 border-[#15130f] pb-3">
            <dt className="text-xs font-bold uppercase tracking-wide text-[#615b51]">Prenom</dt>
            <dd className="mt-1 font-semibold">{profile?.first_name ?? 'N/A'}</dd>
          </div>
          <div className="border-b-2 border-[#15130f] pb-3">
            <dt className="text-xs font-bold uppercase tracking-wide text-[#615b51]">Nom</dt>
            <dd className="mt-1 font-semibold">{profile?.last_name ?? 'N/A'}</dd>
          </div>
        </dl>
      </Card>
    </PageContainer>
  )
}
