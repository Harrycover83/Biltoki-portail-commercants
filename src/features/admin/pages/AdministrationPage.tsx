import { useCallback, useEffect, useMemo, useState } from 'react'
import { clsx } from 'clsx'
import { PageContainer } from '@/components/layout/PageContainer'
import { Card } from '@/components/ui/Card'
import { ROLE_LABELS, ROLE_ORDER, roleLabel } from '@/lib/roles'
import type { UserRole } from '@/types/domain'
import { useAuth } from '@/features/auth/AuthProvider'
import {
  adminUsersService,
  emptyUserForm,
  type AdminOptions,
  type AuditEntry,
  type ManagedUser,
  type UserFormValues,
} from '@/features/admin/services/adminUsersService'
import { UserForm } from '@/features/admin/components/UserForm'

type Credentials = { email: string; password: string; reason: 'created' | 'reset' }

type PendingAction =
  | { type: 'delete'; user: ManagedUser }
  | { type: 'deactivate'; user: ManagedUser }
  | { type: 'reset'; user: ManagedUser }

const AUDIT_LABELS: Record<string, string> = {
  'user.create': 'Compte créé',
  'user.update': 'Compte modifié',
  'user.activate': 'Compte réactivé',
  'user.deactivate': 'Compte désactivé',
  'user.reset_password': 'Mot de passe réinitialisé',
  'user.delete': 'Compte supprimé',
}

const actionButton =
  'rounded-full border border-[#d6cebf] px-3 py-1 text-xs font-bold text-[#171511] hover:bg-[#f7e7b8] disabled:cursor-not-allowed disabled:opacity-40'

function formatDate(value: string | null): string {
  return value
    ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
    : '—'
}

function toFormValues(user: ManagedUser): UserFormValues {
  return {
    email: user.email,
    firstName: user.firstName ?? '',
    lastName: user.lastName ?? '',
    role: user.role,
    jobTitle: user.jobTitle ?? '',
    merchantId: user.merchantId ?? '',
    hallIds: user.hallIds,
  }
}

export function AdministrationPage() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [options, setOptions] = useState<AdminOptions>({ halls: [], merchants: [] })
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [credentials, setCredentials] = useState<Credentials | null>(null)
  const [copied, setCopied] = useState(false)
  const [formMode, setFormMode] = useState<{ type: 'create' } | { type: 'edit'; user: ManagedUser } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all')

  const [reloadKey, setReloadKey] = useState(0)
  const reload = useCallback(() => setReloadKey((key) => key + 1), [])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const [usersResult, optionsResult, auditResult] = await Promise.all([
        adminUsersService.listUsers(),
        adminUsersService.getOptions(),
        adminUsersService.listAudit(),
      ])
      if (cancelled) {
        return
      }
      if (usersResult.error || optionsResult.error) {
        setError(usersResult.error ?? optionsResult.error)
      } else {
        setError(null)
        setUsers(usersResult.data?.users ?? [])
        setOptions(optionsResult.data ?? { halls: [], merchants: [] })
      }
      setAudit(auditResult.data?.entries ?? [])
      setLoading(false)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  const hallNames = useMemo(() => new Map(options.halls.map((hall) => [hall.id, hall.name])), [options.halls])
  const merchantNames = useMemo(
    () => new Map(options.merchants.map((merchant) => [merchant.id, merchant.name])),
    [options.merchants],
  )

  const visibleUsers = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return users
      .filter((user) => roleFilter === 'all' || user.role === roleFilter)
      .filter(
        (user) =>
          !needle ||
          `${user.firstName ?? ''} ${user.lastName ?? ''} ${user.email} ${user.jobTitle ?? ''}`.toLowerCase().includes(needle),
      )
      .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.email.localeCompare(b.email))
  }, [users, search, roleFilter])

  const scopeLabel = (user: ManagedUser): string => {
    if (user.role === 'hq' || user.role === 'super_admin') {
      return 'Toutes les halles'
    }
    if (user.role === 'merchant') {
      return user.merchantId ? (merchantNames.get(user.merchantId) ?? 'Stand inconnu') : '—'
    }
    return user.hallIds.length > 0 ? user.hallIds.map((id) => hallNames.get(id) ?? '?').join(', ') : 'Aucune halle'
  }

  const run = async (task: () => Promise<{ error: string | null }>, success: string) => {
    setSubmitting(true)
    setError(null)
    setNotice(null)
    const result = await task()
    setSubmitting(false)
    if (result.error) {
      setError(result.error)
      return false
    }
    setNotice(success)
    reload()
    return true
  }

  const handleSubmit = async (values: UserFormValues) => {
    if (formMode?.type === 'create') {
      setSubmitting(true)
      setError(null)
      const result = await adminUsersService.createUser(values)
      setSubmitting(false)
      if (result.error || !result.data) {
        setError(result.error ?? 'Création impossible.')
        return
      }
      setCredentials({ email: values.email, password: result.data.provisionalPassword, reason: 'created' })
      setCopied(false)
      setNotice(null)
      setFormMode(null)
      reload()
      return
    }

    if (formMode?.type === 'edit' && formMode.user.userId) {
      const userId = formMode.user.userId
      const ok = await run(() => adminUsersService.updateUser(userId, values), 'Compte mis à jour.')
      if (ok) {
        setFormMode(null)
      }
    }
  }

  const confirmPending = async () => {
    if (!pending?.user.userId) {
      return
    }
    const { type, user } = pending
    const userId = user.userId as string
    setPending(null)

    if (type === 'delete') {
      await run(() => adminUsersService.deleteUser(userId), 'Compte supprimé.')
    } else if (type === 'deactivate') {
      await run(() => adminUsersService.setActive(userId, false), 'Compte désactivé : il ne peut plus se connecter.')
    } else {
      setSubmitting(true)
      const result = await adminUsersService.resetPassword(userId)
      setSubmitting(false)
      if (result.error || !result.data) {
        setError(result.error ?? 'Réinitialisation impossible.')
        return
      }
      setCredentials({ email: user.email, password: result.data.provisionalPassword, reason: 'reset' })
      setCopied(false)
      reload()
    }
  }

  const copyPassword = async () => {
    if (credentials) {
      await navigator.clipboard?.writeText(credentials.password)
      setCopied(true)
    }
  }

  const pendingMessage: Record<PendingAction['type'], string> = {
    delete: 'Supprimer définitivement le compte de',
    deactivate: 'Désactiver (bloquer la connexion de)',
    reset: 'Générer un nouveau mot de passe provisoire pour',
  }

  return (
    <PageContainer>
      <div className="space-y-6">
        <Card
          title="Administration des accès"
          subtitle="Créez les comptes, définissez le niveau d’accès et le périmètre de chacun. Seul l’administrateur total voit cet écran."
        >
          <button
            type="button"
            className="brand-button"
            onClick={() => {
              setFormMode({ type: 'create' })
              setCredentials(null)
              setNotice(null)
            }}
          >
            Ajouter un compte
          </button>
        </Card>

        {error ? (
          <p role="alert" className="bg-[#fdeee9] px-4 py-3 text-sm font-semibold text-[#9b2c15]">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="bg-[#e7f4ec] px-4 py-3 text-sm font-semibold text-[#1f6b3e]">
            {notice}
          </p>
        ) : null}

        {credentials ? (
          <Card
            title={credentials.reason === 'created' ? 'Compte créé' : 'Mot de passe réinitialisé'}
            subtitle={`Transmettez ces identifiants à ${credentials.email}. Le mot de passe provisoire n’est affiché qu’une seule fois ; il devra être changé à la première connexion.`}
          >
            <div className="flex flex-wrap items-center gap-3">
              <code className="bg-[#f7e7b8] px-3 py-2 text-base font-bold tracking-wide text-[#171511]">
                {credentials.password}
              </code>
              <button type="button" className={actionButton} onClick={() => void copyPassword()}>
                {copied ? 'Copié' : 'Copier'}
              </button>
              <button type="button" className={actionButton} onClick={() => setCredentials(null)}>
                J’ai noté le mot de passe, fermer
              </button>
            </div>
          </Card>
        ) : null}

        {formMode ? (
          <Card title={formMode.type === 'create' ? 'Nouveau compte' : `Modifier ${formMode.user.email}`}>
            <UserForm
              key={formMode.type === 'edit' ? formMode.user.email : 'create'}
              mode={formMode.type}
              initial={formMode.type === 'edit' ? toFormValues(formMode.user) : emptyUserForm()}
              options={options}
              submitting={submitting}
              lockRole={formMode.type === 'edit' && formMode.user.userId === currentUser?.id}
              onSubmit={(values) => void handleSubmit(values)}
              onCancel={() => setFormMode(null)}
            />
          </Card>
        ) : null}

        {pending ? (
          <div role="alertdialog" aria-label="Confirmation" className="border-l-4 border-[#d84d2c] bg-[#fdeee9] px-4 py-3">
            <p className="text-sm font-semibold text-[#171511]">
              {pendingMessage[pending.type]} {pending.user.firstName} {pending.user.lastName} ({pending.user.email}) ?
            </p>
            <div className="mt-3 flex gap-3">
              <button type="button" className="brand-button" onClick={() => void confirmPending()}>
                Confirmer
              </button>
              <button type="button" className={actionButton} onClick={() => setPending(null)}>
                Annuler
              </button>
            </div>
          </div>
        ) : null}

        <Card title={`Comptes (${visibleUsers.length})`}>
          <div className="mb-4 flex flex-wrap gap-3">
            <input
              className="brand-input min-w-[220px] flex-1"
              placeholder="Rechercher un nom, un e-mail…"
              aria-label="Rechercher un compte"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select
              className="brand-input"
              aria-label="Filtrer par niveau d’accès"
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value as UserRole | 'all')}
            >
              <option value="all">Tous les niveaux</option>
              {ROLE_ORDER.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <p className="text-sm text-[#615b51]">Chargement…</p>
          ) : visibleUsers.length === 0 ? (
            <p className="text-sm text-[#615b51]">Aucun compte.</p>
          ) : (
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
                  {visibleUsers.map((user) => {
                    const isSelf = user.userId !== null && user.userId === currentUser?.id
                    const canAct = user.provisioned
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
                          <span
                            className={clsx(
                              'inline-block px-2 py-1 text-xs font-bold',
                              !user.provisioned
                                ? 'bg-[#e8f0f8] text-[#2468a8]'
                                : user.active
                                  ? 'bg-[#e7f4ec] text-[#1f6b3e]'
                                  : 'bg-[#fdeee9] text-[#9b2c15]',
                            )}
                          >
                            {!user.provisioned ? 'En attente' : user.active ? 'Actif' : 'Désactivé'}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-xs text-[#615b51]">{formatDate(user.lastSignInAt)}</td>
                        <td className="py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className={actionButton}
                              disabled={!canAct || submitting}
                              onClick={() => {
                                setFormMode({ type: 'edit', user })
                                setCredentials(null)
                              }}
                            >
                              Modifier
                            </button>
                            {user.active ? (
                              <button
                                type="button"
                                className={actionButton}
                                disabled={!canAct || isSelf || submitting}
                                onClick={() => setPending({ type: 'deactivate', user })}
                              >
                                Désactiver
                              </button>
                            ) : (
                              <button
                                type="button"
                                className={actionButton}
                                disabled={!canAct || submitting}
                                onClick={() =>
                                  void run(() => adminUsersService.setActive(user.userId as string, true), 'Compte réactivé.')
                                }
                              >
                                Réactiver
                              </button>
                            )}
                            <button
                              type="button"
                              className={actionButton}
                              disabled={!canAct || submitting}
                              onClick={() => setPending({ type: 'reset', user })}
                            >
                              Mot de passe
                            </button>
                            <button
                              type="button"
                              className={actionButton}
                              disabled={!canAct || isSelf || submitting}
                              onClick={() => setPending({ type: 'delete', user })}
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
          )}
        </Card>

        <Card title="Journal des modifications" subtitle="Les 50 dernières actions d’administration.">
          {audit.length === 0 ? (
            <p className="text-sm text-[#615b51]">Aucune action enregistrée.</p>
          ) : (
            <ul className="divide-y divide-[#e4ddd1] text-sm">
              {audit.map((entry) => (
                <li key={entry.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <span>
                    <strong>{AUDIT_LABELS[entry.action] ?? entry.action}</strong> · {entry.target_email ?? '—'}
                  </span>
                  <span className="text-xs text-[#615b51]">
                    {entry.actor_email ?? 'système'} · {formatDate(entry.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </PageContainer>
  )
}
