import { clsx } from 'clsx'
import type { ManagedUser } from '@/features/admin/services/adminUsersService'
import { formatDateTime } from '@/lib/format'
import { roleLabel } from '@/lib/roles'
import { ACTION_BUTTON_CLASS } from './styles'

type UsersTableProps = {
  users: ManagedUser[]
  currentUserId: string | undefined
  busy: boolean
  scopeLabel: (user: ManagedUser) => string
  onEdit: (user: ManagedUser) => void
  onDeactivate: (user: ManagedUser) => void
  onReactivate: (user: ManagedUser) => void
  onResetPassword: (user: ManagedUser) => void
  onDelete: (user: ManagedUser) => void
}

function statusOf(user: ManagedUser): { label: string; className: string } {
  if (!user.provisioned) {
    return { label: 'En attente', className: 'bg-[#e8f0f8] text-[#2468a8]' }
  }
  return user.active
    ? { label: 'Actif', className: 'bg-[#e7f4ec] text-[#1f6b3e]' }
    : { label: 'Désactivé', className: 'bg-[#fdeee9] text-[#9b2c15]' }
}

export function UsersTable({
  users,
  currentUserId,
  busy,
  scopeLabel,
  onEdit,
  onDeactivate,
  onReactivate,
  onResetPassword,
  onDelete,
}: UsersTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-[#13223a1f] text-[#626a78]">
            <th className="py-2 pr-4">Compte</th>
            <th className="py-2 pr-4">Niveau d’accès</th>
            <th className="py-2 pr-4">Périmètre</th>
            <th className="py-2 pr-4">Statut</th>
            <th className="py-2 pr-4">Dernière connexion</th>
            <th className="py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const isSelf = user.userId !== null && user.userId === currentUserId
            const canAct = user.provisioned
            const status = statusOf(user)
            return (
              <tr key={user.email} className="border-b border-[#e4ddd1] align-top">
                <td className="py-3 pr-4">
                  <p className="font-bold text-[#171511]">
                    {user.firstName} {user.lastName}
                    {isSelf ? <span className="ml-2 text-xs font-semibold text-[#615b51]">(vous)</span> : null}
                  </p>
                  <p className="text-xs text-[#615b51]">{user.email}</p>
                </td>
                <td className="py-3 pr-4">
                  <p className="font-semibold">{roleLabel(user.role)}</p>
                  {user.jobTitle ? <p className="text-xs text-[#615b51]">{user.jobTitle}</p> : null}
                </td>
                <td className="py-3 pr-4">{scopeLabel(user)}</td>
                <td className="py-3 pr-4">
                  <span className={clsx('inline-block px-2 py-1 text-xs font-bold', status.className)}>
                    {status.label}
                  </span>
                </td>
                <td className="py-3 pr-4 text-xs text-[#615b51]">{formatDateTime(user.lastSignInAt)}</td>
                <td className="py-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={ACTION_BUTTON_CLASS}
                      disabled={!canAct || busy}
                      onClick={() => onEdit(user)}
                    >
                      Modifier
                    </button>
                    {user.active ? (
                      <button
                        type="button"
                        className={ACTION_BUTTON_CLASS}
                        disabled={!canAct || isSelf || busy}
                        onClick={() => onDeactivate(user)}
                      >
                        Désactiver
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={ACTION_BUTTON_CLASS}
                        disabled={!canAct || busy}
                        onClick={() => onReactivate(user)}
                      >
                        Réactiver
                      </button>
                    )}
                    <button
                      type="button"
                      className={ACTION_BUTTON_CLASS}
                      disabled={!canAct || busy}
                      onClick={() => onResetPassword(user)}
                    >
                      Mot de passe
                    </button>
                    <button
                      type="button"
                      className={ACTION_BUTTON_CLASS}
                      disabled={!canAct || isSelf || busy}
                      onClick={() => onDelete(user)}
                    >
                      Supprimer
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
