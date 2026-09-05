import type { PropsWithChildren } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthProvider'

export function ProtectedRoute({ children }: PropsWithChildren) {
  const { loading, user, configurationError, mustChangePassword } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div className="p-6 text-sm font-semibold text-[#15130f]">Chargement de la session...</div>
  }

  if (configurationError) {
    return <div className="m-6 border-2 border-[#15130f] bg-[#f1a72d] p-4 text-sm font-semibold text-[#15130f]">{configurationError}</div>
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (mustChangePassword && location.pathname !== '/security/update-password') {
    return <Navigate to="/security/update-password" replace />
  }

  return <>{children}</>
}
