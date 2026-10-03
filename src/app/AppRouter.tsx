import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppHeader } from '../components/layout/AppHeader'
import { ProtectedRoute } from './guards/ProtectedRoute'
import { RoleRoute } from './guards/RoleRoute'
import { LoginPage } from '../features/auth/pages/LoginPage'
import { UpdatePasswordPage } from '../features/auth/pages/UpdatePasswordPage'
import { HistoryPage } from '../features/merchant/pages/HistoryPage'
import { RevenuePage } from '../features/merchant/pages/RevenuePage'
import { ProfilePage } from '../features/merchant/pages/ProfilePage'
import { AdminServiceChargesPage } from '../features/admin/pages/AdminServiceChargesPage'
import { AdminRevenuePage } from '../features/admin/pages/AdminRevenuePage'
import { AdminDashboardPage } from '../features/admin/pages/AdminDashboardPage'
import { AdminHallProvider } from '../features/admin/AdminHallContext'
import { NotFoundPage } from '../features/common/pages/NotFoundPage'
import { useAuth } from '../features/auth/AuthProvider'
import { AdministrationPage } from '../features/admin/pages/AdministrationPage'
import { homePathForRole } from '../lib/roles'
import type { UserRole } from '../types/domain'

const STAFF_ROLES: UserRole[] = ['hall_manager', 'network_manager', 'hq', 'super_admin']
const SUPER_ADMIN_ONLY: UserRole[] = ['super_admin']

const AdminChartsPage = lazy(() =>
  import('../features/admin/pages/AdminChartsPage').then((module) => ({ default: module.AdminChartsPage })),
)

function PrivateLayout({ children }: { children: ReactNode }) {
  return (
    <AdminHallProvider>
      <div className="brand-shell min-h-screen">
        <AppHeader />
        {children}
      </div>
    </AdminHallProvider>
  )
}

function HomeRedirect() {
  const { role } = useAuth()
  return <Navigate to={homePathForRole(role)} replace />
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
              <HomeRedirect />
            </ProtectedRoute>
          }
        />

        <Route
          path="/frais"
          element={
            <ProtectedRoute>
              <Navigate to="/historique" replace />
            </ProtectedRoute>
          }
        />

        <Route
          path="/frais/:periodId"
          element={
            <ProtectedRoute>
              <Navigate to="/historique" replace />
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
          path="/ca"
          element={
            <ProtectedRoute>
              <PrivateLayout>
                <RevenuePage />
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
              <RoleRoute roles={STAFF_ROLES}>
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
              <RoleRoute roles={STAFF_ROLES}>
                <Navigate to="/admin/frais" replace />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/frais"
          element={
            <ProtectedRoute>
              <RoleRoute roles={STAFF_ROLES}>
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
              <RoleRoute roles={STAFF_ROLES}>
                <Navigate to="/admin/frais" replace />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/synchronisation"
          element={
            <ProtectedRoute>
              <RoleRoute roles={STAFF_ROLES}>
                <Navigate to="/admin/frais" replace />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/graphiques"
          element={
            <ProtectedRoute>
              <RoleRoute roles={STAFF_ROLES}>
                <PrivateLayout>
                  <Suspense fallback={<div className="p-6 text-sm text-[#626a78]">Chargement des graphiques...</div>}>
                    <AdminChartsPage />
                  </Suspense>
                </PrivateLayout>
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/administration"
          element={
            <ProtectedRoute>
              <RoleRoute roles={SUPER_ADMIN_ONLY}>
                <PrivateLayout>
                  <AdministrationPage />
                </PrivateLayout>
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/ca"
          element={
            <ProtectedRoute>
              <RoleRoute roles={STAFF_ROLES}>
                <PrivateLayout>
                  <AdminRevenuePage />
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
