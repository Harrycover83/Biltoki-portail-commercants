import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../app/AuthContext'

const navLinks = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/frais', label: 'Frais' },
  { to: '/historique', label: 'Historique' },
  { to: '/profil', label: 'Profil' },
]

export function AppShell() {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between p-4">
          <Link className="font-semibold" to="/dashboard">
            Portail Commerçants Biltoki
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <span>{user?.email}</span>
            {user?.role === 'admin' ? (
              <Link className="text-blue-600" to="/admin/dashboard">
                Administration
              </Link>
            ) : null}
            <button className="rounded border px-2 py-1" onClick={() => logout()} type="button">
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-4 p-4 md:grid-cols-[220px_1fr]">
        <aside className="rounded border bg-white p-3">
          <nav className="space-y-1 text-sm">
            {navLinks.map((item) => (
              <NavLink
                className={({ isActive }) =>
                  `block rounded px-2 py-1 ${isActive ? 'bg-slate-100 font-medium' : 'hover:bg-slate-50'}`
                }
                key={item.to}
                to={item.to}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="rounded border bg-white p-4">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
