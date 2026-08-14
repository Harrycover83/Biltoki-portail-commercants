import type { PropsWithChildren } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthProvider'
import type { UserRole } from '../../types/domain'

type RoleRouteProps = PropsWithChildren<{
  role: UserRole
}>

export function RoleRoute({ role, children }: RoleRouteProps) {
  const { loading, user, role: currentRole } = useAuth()

  if (loading) {
    return <div className="p-6 text-sm text-slate-600">Verification des droits...</div>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (currentRole !== role) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
