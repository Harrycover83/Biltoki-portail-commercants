import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { AuthGuard, RoleGuard } from './components/RouteGuards'
import { AdminAllocationsPage } from './pages/admin/AdminAllocationsPage'
import { AdminChargesPage } from './pages/admin/AdminChargesPage'
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage'
import { AdminMerchantDetailPage } from './pages/admin/AdminMerchantDetailPage'
import { AdminMerchantsPage } from './pages/admin/AdminMerchantsPage'
import { AdminPeriodsPage } from './pages/admin/AdminPeriodsPage'
import { AdminStandsPage } from './pages/admin/AdminStandsPage'
import { AdminSyncPage } from './pages/admin/AdminSyncPage'
import { ChargeDetailPage } from './pages/ChargeDetailPage'
import { ChargesPage } from './pages/ChargesPage'
import { HistoryPage } from './pages/HistoryPage'
import { LoginPage } from './pages/LoginPage'
import { MerchantDashboardPage } from './pages/MerchantDashboardPage'
import { ProfilePage } from './pages/ProfilePage'

function App() {
  return (
    <Routes>
      <Route element={<LoginPage />} path="/login" />

      <Route element={<AuthGuard />}>
        <Route element={<AppShell />}>
          <Route element={<MerchantDashboardPage />} path="/dashboard" />
          <Route element={<ChargesPage />} path="/frais" />
          <Route element={<ChargeDetailPage />} path="/frais/:periodId" />
          <Route element={<HistoryPage />} path="/historique" />
          <Route element={<ProfilePage />} path="/profil" />

          <Route element={<RoleGuard allowedRoles={['admin']} />}>
            <Route element={<AdminDashboardPage />} path="/admin/dashboard" />
            <Route element={<AdminMerchantsPage />} path="/admin/commercants" />
            <Route element={<AdminMerchantDetailPage />} path="/admin/commercants/:id" />
            <Route element={<AdminStandsPage />} path="/admin/stands" />
            <Route element={<AdminChargesPage />} path="/admin/frais" />
            <Route element={<AdminPeriodsPage />} path="/admin/periodes" />
            <Route element={<AdminAllocationsPage />} path="/admin/repartitions" />
            <Route element={<AdminSyncPage />} path="/admin/synchronisation" />
          </Route>
        </Route>
      </Route>

      <Route element={<Navigate replace to="/dashboard" />} path="*" />
    </Routes>
  )
}

export default App
