import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppHeader } from '@/components/layout/AppHeader'
import { AdminHallProvider } from '@/features/admin/AdminHallContext'
import { useAuth } from '@/features/auth/AuthProvider'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { NotFoundPage } from '@/features/common/pages/NotFoundPage'
import { homePathForRole, STAFF_ROLES } from '@/lib/roles'
import type { UserRole } from '@/types/domain'
import { ProtectedRoute } from './guards/ProtectedRoute'
import { RoleRoute } from './guards/RoleRoute'

const SUPER_ADMIN_ONLY: UserRole[] = ['super_admin']

// Pages are split into their own chunks so heavy dependencies (charts) only load where they are used.
const UpdatePasswordPage = lazy(() =>
  import('@/features/auth/pages/UpdatePasswordPage').then((m) => ({ default: m.UpdatePasswordPage })),
)
const HistoryPage = lazy(() =>
  import('@/features/merchant/pages/HistoryPage').then((m) => ({ default: m.HistoryPage })),
)
const RevenuePage = lazy(() =>
  import('@/features/merchant/pages/RevenuePage').then((m) => ({ default: m.RevenuePage })),
)
const ProfilePage = lazy(() =>
  import('@/features/merchant/pages/ProfilePage').then((m) => ({ default: m.ProfilePage })),
)
const AdminDashboardPage = lazy(() =>
  import('@/features/admin/pages/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })),
)
const AdminServiceChargesPage = lazy(() =>
  import('@/features/admin/pages/AdminServiceChargesPage').then((m) => ({ default: m.AdminServiceChargesPage })),
)
const AdminChartsPage = lazy(() =>
  import('@/features/admin/pages/AdminChartsPage').then((m) => ({ default: m.AdminChartsPage })),
)
const AdminRevenuePage = lazy(() =>
  import('@/features/admin/pages/AdminRevenuePage').then((m) => ({ default: m.AdminRevenuePage })),
)
const AdministrationPage = lazy(() =>
  import('@/features/admin/pages/AdministrationPage').then((m) => ({ default: m.AdministrationPage })),
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

function PageFallback() {
  return <div className="p-6 text-sm text-[#626a78]">Chargement...</div>
}

function PrivateLayout({ children }: { children: ReactNode }) {
  return (
    <AdminHallProvider>
      <div className="brand-shell min-h-screen">
        <AppHeader />
        <Suspense fallback={<PageFallback />}>{children}</Suspense>
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
              <Suspense fallback={<PageFallback />}>
                <UpdatePasswordPage />
              </Suspense>
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
              <AdminChartsPage />
            </Page>
          }
        />
        <Route path="/admin/administration" element={<Page roles={SUPER_ADMIN_ONLY}><AdministrationPage /></Page>} />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
