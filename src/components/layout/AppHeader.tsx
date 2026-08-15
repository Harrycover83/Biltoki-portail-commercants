import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthProvider'

export function AppHeader() {
  const { user, profile, signOut } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const homePath = isAdmin ? '/admin/dashboard' : '/dashboard'

  const navClassName = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? 'rounded-full bg-[#13223a] px-3 py-2 text-sm font-semibold text-white shadow-sm'
      : 'rounded-full px-3 py-2 text-sm font-semibold text-[#2a3242] hover:bg-[#13223a14]'

  return (
    <header className="sticky top-0 z-20 border-b border-[#13223a1f] bg-[#fff8ef]/88 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 md:px-6">
        <Link to={homePath} className="brand-display text-[1.35rem] font-semibold leading-none">
          Biltoki Commercants
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {isAdmin ? (
            <>
              <NavLink to="/admin/dashboard" className={navClassName}>
                Dashboard
              </NavLink>
              <NavLink to="/admin/frais" className={navClassName}>
                Frais
              </NavLink>
              <NavLink to="/admin/periodes" className={navClassName}>
                Periodes
              </NavLink>
              <NavLink to="/admin/stands" className={navClassName}>
                Stands
              </NavLink>
              <NavLink to="/admin/synchronisation" className={navClassName}>
                Synchronisation
              </NavLink>
            </>
          ) : (
            <>
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
            </>
          )}
        </nav>
        <div className="flex items-center gap-3">
          {profile?.role ? <span className="brand-badge hidden md:inline-flex">{profile.role}</span> : null}
          {user ? <span className="hidden text-xs text-[#4a5261] md:inline">{user.email}</span> : null}
          <button
            type="button"
            className="rounded-full border border-[#13223a3b] px-3 py-2 text-sm font-medium text-[#13223a] hover:bg-[#13223a0f]"
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
