import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppHeader } from '../components/layout/AppHeader'
import { ProtectedRoute } from './guards/ProtectedRoute'
import { RoleRoute } from './guards/RoleRoute'
import { LoginPage } from '../features/auth/pages/LoginPage'
import { UpdatePasswordPage } from '../features/auth/pages/UpdatePasswordPage'
import { DashboardPage } from '../features/merchant/pages/DashboardPage'
import { ChargesPage } from '../features/merchant/pages/ChargesPage'
import { ChargeDetailPage } from '../features/merchant/pages/ChargeDetailPage'
import { HistoryPage } from '../features/merchant/pages/HistoryPage'
import { ProfilePage } from '../features/merchant/pages/ProfilePage'
import { AdminDashboardPage } from '../features/admin/pages/AdminDashboardPage'
import { AdminServiceChargesPage } from '../features/admin/pages/AdminServiceChargesPage'
import { AdminSyncPage } from '../features/admin/pages/AdminSyncPage'
import { NotFoundPage } from '../features/common/pages/NotFoundPage'
import { useAuth } from '../features/auth/AuthProvider'

function PrivateLayout({ children }: { children: ReactNode }) {
  return (
    <div className="brand-shell min-h-screen">
      <AppHeader />
      {children}
    </div>
  )
}

function HomeRedirect() {
  const { role } = useAuth()
  return <Navigate to={role === 'admin' ? '/admin/dashboard' : '/dashboard'} replace />
}

function DashboardEntry() {
  const { role } = useAuth()
  if (role === 'admin') {
    return <Navigate to="/admin/dashboard" replace />
  }
  return <DashboardPage />
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/security/update-password"
          element={
            <ProtectedRoute>
              <UpdatePasswordPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <PrivateLayout>
                <DashboardEntry />
              </PrivateLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/frais"
          element={
            <ProtectedRoute>
              <PrivateLayout>
                <ChargesPage />
              </PrivateLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/frais/:periodId"
          element={
            <ProtectedRoute>
              <PrivateLayout>
                <ChargeDetailPage />
              </PrivateLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/historique"
          element={
            <ProtectedRoute>
              <PrivateLayout>
                <HistoryPage />
              </PrivateLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/profil"
          element={
            <ProtectedRoute>
              <PrivateLayout>
                <ProfilePage />
              </PrivateLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute>
              <RoleRoute role="admin">
                <PrivateLayout>
                  <AdminDashboardPage />
                </PrivateLayout>
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/commercants"
          element={
            <ProtectedRoute>
              <RoleRoute role="admin">
                <Navigate to="/admin/dashboard" replace />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/frais"
          element={
            <ProtectedRoute>
              <RoleRoute role="admin">
                <PrivateLayout>
                  <AdminServiceChargesPage />
                </PrivateLayout>
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/repartitions"
          element={
            <ProtectedRoute>
              <RoleRoute role="admin">
                <Navigate to="/admin/frais" replace />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/synchronisation"
          element={
            <ProtectedRoute>
              <RoleRoute role="admin">
                <PrivateLayout>
                  <AdminSyncPage />
                </PrivateLayout>
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <HomeRedirect />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
