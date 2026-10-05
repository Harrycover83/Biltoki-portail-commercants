import type { PropsWithChildren } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { homePathForRole } from '@/lib/roles'
import type { UserRole } from '@/types/domain'

type RoleRouteProps = PropsWithChildren<{
  roles: UserRole[]
}>

export function RoleRoute({ roles, children }: RoleRouteProps) {
  const { loading, user, role: currentRole } = useAuth()

  if (loading) {
    return <div className="p-6 text-sm font-semibold text-[#15130f]">Verification des droits...</div>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!currentRole || !roles.includes(currentRole)) {
    return <Navigate to={homePathForRole(currentRole)} replace />
  }

  return <>{children}</>
}
