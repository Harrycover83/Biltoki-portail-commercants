import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthProvider'

export function AppHeader() {
  const { user, profile, signOut } = useAuth()

  const navClassName = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? 'rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white'
      : 'rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100'

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 md:px-6">
        <Link to="/dashboard" className="text-lg font-semibold tracking-tight text-slate-900">
          Portail Commercants
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          <NavLink to="/dashboard" className={navClassName}>
            Dashboard
          </NavLink>
          <NavLink to="/frais" className={navClassName}>
            Frais
          </NavLink>
          <NavLink to="/historique" className={navClassName}>
            Historique
          </NavLink>
          <NavLink to="/profil" className={navClassName}>
            Profil
          </NavLink>
          {profile?.role === 'admin' ? (
            <NavLink to="/admin/dashboard" className={navClassName}>
              Administration
            </NavLink>
          ) : null}
        </nav>
        <div className="flex items-center gap-3">
          {user ? <span className="hidden text-xs text-slate-500 md:inline">{user.email}</span> : null}
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            onClick={() => {
              void signOut()
            }}
          >
            Deconnexion
          </button>
        </div>
      </div>
    </header>
  )
}
