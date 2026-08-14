import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppHeader } from '../components/layout/AppHeader'
import { ProtectedRoute } from './guards/ProtectedRoute'
import { RoleRoute } from './guards/RoleRoute'
import { LoginPage } from '../features/auth/pages/LoginPage'
import { ResetPasswordPage } from '../features/auth/pages/ResetPasswordPage'
import { UpdatePasswordPage } from '../features/auth/pages/UpdatePasswordPage'
import { ResetPasswordUpdatePage } from '../features/auth/pages/ResetPasswordUpdatePage'
import { DashboardPage } from '../features/merchant/pages/DashboardPage'
import { ChargesPage } from '../features/merchant/pages/ChargesPage'
import { ChargeDetailPage } from '../features/merchant/pages/ChargeDetailPage'
import { HistoryPage } from '../features/merchant/pages/HistoryPage'
import { ProfilePage } from '../features/merchant/pages/ProfilePage'
import { AdminDashboardPage } from '../features/admin/pages/AdminDashboardPage'
import { AdminMerchantsPage } from '../features/admin/pages/AdminMerchantsPage'
import { AdminStandsPage } from '../features/admin/pages/AdminStandsPage'
import { AdminServiceChargesPage } from '../features/admin/pages/AdminServiceChargesPage'
import { AdminPeriodsPage } from '../features/admin/pages/AdminPeriodsPage'
import { AdminAllocationsPage } from '../features/admin/pages/AdminAllocationsPage'
import { AdminSyncPage } from '../features/admin/pages/AdminSyncPage'
import { NotFoundPage } from '../features/common/pages/NotFoundPage'

function PrivateLayout({ children }: { children: ReactNode }) {
  return (
    <div className="brand-shell min-h-screen">
      <AppHeader />
      {children}
    </div>
  )
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/reset-password/update" element={<ResetPasswordUpdatePage />} />

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
                <DashboardPage />
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
                <PrivateLayout>
                  <AdminMerchantsPage />
                </PrivateLayout>
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/stands"
          element={
            <ProtectedRoute>
              <RoleRoute role="admin">
                <PrivateLayout>
                  <AdminStandsPage />
                </PrivateLayout>
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
          path="/admin/periodes"
          element={
            <ProtectedRoute>
              <RoleRoute role="admin">
                <PrivateLayout>
                  <AdminPeriodsPage />
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
                <PrivateLayout>
                  <AdminAllocationsPage />
                </PrivateLayout>
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

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
