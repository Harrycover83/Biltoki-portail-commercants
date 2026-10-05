import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppHeader } from '@/components/layout/AppHeader'
import { AdminHallProvider } from '@/features/admin/AdminHallContext'
import { AdminDashboardPage } from '@/features/admin/pages/AdminDashboardPage'
import { AdminRevenuePage } from '@/features/admin/pages/AdminRevenuePage'
import { AdminServiceChargesPage } from '@/features/admin/pages/AdminServiceChargesPage'
import { AdministrationPage } from '@/features/admin/pages/AdministrationPage'
import { useAuth } from '@/features/auth/AuthProvider'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { UpdatePasswordPage } from '@/features/auth/pages/UpdatePasswordPage'
import { NotFoundPage } from '@/features/common/pages/NotFoundPage'
import { HistoryPage } from '@/features/merchant/pages/HistoryPage'
import { ProfilePage } from '@/features/merchant/pages/ProfilePage'
import { RevenuePage } from '@/features/merchant/pages/RevenuePage'
import { homePathForRole, STAFF_ROLES } from '@/lib/roles'
import type { UserRole } from '@/types/domain'
import { ProtectedRoute } from './guards/ProtectedRoute'
import { RoleRoute } from './guards/RoleRoute'

const SUPER_ADMIN_ONLY: UserRole[] = ['super_admin']

const AdminChartsPage = lazy(() =>
  import('@/features/admin/pages/AdminChartsPage').then((module) => ({ default: module.AdminChartsPage })),
)

/** Legacy URLs kept alive for bookmarks; each one now lands on its replacement. */
const MERCHANT_REDIRECTS: Record<string, string> = {
  '/frais': '/historique',
  '/frais/:periodId': '/historique',
}

const STAFF_REDIRECTS: Record<string, string> = {
  '/admin/commercants': '/admin/frais',
  '/admin/repartitions': '/admin/frais',
  '/admin/synchronisation': '/admin/frais',
}

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

/** Requires a session and, when `roles` is given, one of these roles. */
function Guarded({ roles, children }: { roles?: UserRole[]; children: ReactNode }) {
  return <ProtectedRoute>{roles ? <RoleRoute roles={roles}>{children}</RoleRoute> : children}</ProtectedRoute>
}

/** A guarded page rendered inside the application shell (header + hall selector). */
function Page({ roles, children }: { roles?: UserRole[]; children: ReactNode }) {
  return (
    <Guarded roles={roles}>
      <PrivateLayout>{children}</PrivateLayout>
    </Guarded>
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
            <Guarded>
              <UpdatePasswordPage />
            </Guarded>
          }
        />

        {['/', '/dashboard'].map((path) => (
          <Route
            key={path}
            path={path}
            element={
              <Guarded>
                <HomeRedirect />
              </Guarded>
            }
          />
        ))}

        {Object.entries(MERCHANT_REDIRECTS).map(([from, to]) => (
          <Route key={from} path={from} element={<Guarded><Navigate to={to} replace /></Guarded>} />
        ))}

        <Route path="/historique" element={<Page><HistoryPage /></Page>} />
        <Route path="/ca" element={<Page><RevenuePage /></Page>} />
        <Route path="/profil" element={<Page><ProfilePage /></Page>} />

        {Object.entries(STAFF_REDIRECTS).map(([from, to]) => (
          <Route
            key={from}
            path={from}
            element={<Guarded roles={STAFF_ROLES}><Navigate to={to} replace /></Guarded>}
          />
        ))}

        <Route path="/admin/dashboard" element={<Page roles={STAFF_ROLES}><AdminDashboardPage /></Page>} />
        <Route path="/admin/frais" element={<Page roles={STAFF_ROLES}><AdminServiceChargesPage /></Page>} />
        <Route path="/admin/ca" element={<Page roles={STAFF_ROLES}><AdminRevenuePage /></Page>} />
        <Route
          path="/admin/graphiques"
          element={
            <Page roles={STAFF_ROLES}>
              <Suspense fallback={<div className="p-6 text-sm text-[#626a78]">Chargement des graphiques...</div>}>
                <AdminChartsPage />
              </Suspense>
            </Page>
          }
        />
        <Route path="/admin/administration" element={<Page roles={SUPER_ADMIN_ONLY}><AdministrationPage /></Page>} />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
