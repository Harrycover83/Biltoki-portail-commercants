import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../app/AuthContext'
import type { UserRole } from '../types/auth'

export function AuthGuard() {
  const { loading, user } = useAuth()

  if (loading) {
    return <p className="p-6 text-sm text-slate-500">Chargement de la session…</p>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

export function RoleGuard({ allowedRoles }: { allowedRoles: UserRole[] }) {
  const { user } = useAuth()

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
