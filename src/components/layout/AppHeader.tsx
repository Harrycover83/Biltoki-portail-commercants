import { Link, NavLink, useLocation } from 'react-router-dom'
import { useAdminHall } from '../../features/admin/AdminHallContext'
import { useAuth } from '../../features/auth/AuthProvider'

export function AppHeader() {
  const { user, profile, signOut } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const homePath = isAdmin ? '/admin/frais' : '/historique'
  const location = useLocation()
  const { halls, selectedHallId, setSelectedHallId, loading } = useAdminHall()

  const navClassName = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? 'bg-[#348b57] px-3 py-2 text-sm font-bold text-white shadow-sm'
      : 'px-3 py-2 text-sm font-bold text-[#171511] hover:bg-[#f7e7b8]'

  return (
    <header className="sticky top-0 z-20 border-b border-[#e4ddd1] bg-[#fffcf6]/95 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 md:px-6">
        <Link to={homePath} className="brand-display text-[1.35rem] font-semibold leading-none">
          Biltoki Commercants
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {isAdmin ? (
            <>
              <NavLink to="/admin/frais" className={navClassName}>
                Historique
              </NavLink>
              <NavLink to="/admin/synchronisation" className={navClassName}>
                Synchronisation
              </NavLink>
            </>
          ) : (
            <>
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
            className="rounded-full border px-3 py-2 text-sm font-bold text-[#171511] hover:bg-[#f7e7b8]"
            onClick={() => {
              void signOut()
            }}
          >
            Deconnexion
          </button>
        </div>
      </div>

      {isAdmin && location.pathname.startsWith('/admin') ? (
        <div className="border-t border-[#e4ddd1] bg-[#f7e7b8]">
          <div className="mx-auto max-w-6xl px-4 py-3 md:px-6">
            <label className="flex items-center gap-3 text-sm font-medium text-[#4d5562]">
              <span>Halle observée</span>
              <select
                value={selectedHallId}
                disabled={loading || halls.length === 0}
                onChange={(event) => setSelectedHallId(event.target.value)}
                className="rounded-full border border-[#d6cebf] bg-[#fffcf6] px-3 py-2 text-sm text-[#171511] shadow-sm outline-none focus:border-[#d84d2c]"
              >
                {halls.map((hall) => (
                  <option key={hall.id} value={hall.id}>
                    {hall.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      ) : null}
    </header>
  )
}
