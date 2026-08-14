import type { PropsWithChildren } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthProvider'

export function ProtectedRoute({ children }: PropsWithChildren) {
  const { loading, user, configurationError } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div className="p-6 text-sm text-slate-600">Chargement de la session...</div>
  }

  if (configurationError) {
    return <div className="p-6 text-sm text-amber-700">{configurationError}</div>
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}
