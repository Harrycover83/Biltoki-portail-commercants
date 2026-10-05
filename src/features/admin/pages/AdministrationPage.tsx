import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageContainer } from '@/components/layout/PageContainer'
import { Card } from '@/components/ui/Card'
import { AuditLog } from '@/features/admin/components/AuditLog'
import { ConfirmBar } from '@/features/admin/components/ConfirmBar'
import { CredentialsCard, type Credentials } from '@/features/admin/components/CredentialsCard'
import { UserForm } from '@/features/admin/components/UserForm'
import { UsersTable } from '@/features/admin/components/UsersTable'
import {
  adminUsersService,
  emptyUserForm,
  type AdminOptions,
  type AuditEntry,
  type ManagedUser,
  type UserFormValues,
} from '@/features/admin/services/adminUsersService'
import { useAuth } from '@/features/auth/AuthProvider'
import { ROLE_LABELS, ROLE_ORDER } from '@/lib/roles'
import type { UserRole } from '@/types/domain'

type PendingAction =
  | { type: 'delete'; user: ManagedUser }
  | { type: 'deactivate'; user: ManagedUser }
  | { type: 'reset'; user: ManagedUser }

type FormMode = { type: 'create' } | { type: 'edit'; user: ManagedUser }

const PENDING_MESSAGES: Record<PendingAction['type'], string> = {
  delete: 'Supprimer définitivement le compte de',
  deactivate: 'Désactiver (bloquer la connexion de)',
  reset: 'Générer un nouveau mot de passe provisoire pour',
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
  const [formMode, setFormMode] = useState<FormMode | null>(null)
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
      reload()
    }
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
          <CredentialsCard key={credentials.password} credentials={credentials} onClose={() => setCredentials(null)} />
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
          <ConfirmBar
            message={`${PENDING_MESSAGES[pending.type]} ${pending.user.firstName} ${pending.user.lastName} (${pending.user.email}) ?`}
            onConfirm={() => void confirmPending()}
            onCancel={() => setPending(null)}
          />
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
            <UsersTable
              users={visibleUsers}
              currentUserId={currentUser?.id}
              busy={submitting}
              scopeLabel={scopeLabel}
              onEdit={(user) => {
                setFormMode({ type: 'edit', user })
                setCredentials(null)
              }}
              onDeactivate={(user) => setPending({ type: 'deactivate', user })}
              onReactivate={(user) =>
                void run(() => adminUsersService.setActive(user.userId as string, true), 'Compte réactivé.')
              }
              onResetPassword={(user) => setPending({ type: 'reset', user })}
              onDelete={(user) => setPending({ type: 'delete', user })}
            />
          )}
        </Card>

        <AuditLog entries={audit} />
      </div>
    </PageContainer>
  )
}
