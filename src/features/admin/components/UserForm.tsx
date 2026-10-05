import { useState, type FormEvent } from 'react'
import { JOB_TITLE_SUGGESTIONS, ROLE_DESCRIPTIONS, ROLE_LABELS, ROLE_ORDER } from '@/lib/roles'
import type { UserRole } from '@/types/domain'
import type { AdminOptions, UserFormValues } from '@/features/admin/services/adminUsersService'

type UserFormProps = {
  mode: 'create' | 'edit'
  initial: UserFormValues
  options: AdminOptions
  submitting: boolean
  lockRole: boolean
  onSubmit: (values: UserFormValues) => void
  onCancel: () => void
}

function normalizeHalls(role: UserRole, hallIds: string[]): string[] {
  if (role === 'hall_manager') {
    return hallIds.slice(0, 1)
  }
  return role === 'network_manager' ? hallIds : []
}

const labelClass = 'block text-xs font-bold uppercase tracking-[0.08em] text-[#615b51]'

export function UserForm({ mode, initial, options, submitting, lockRole, onSubmit, onCancel }: UserFormProps) {
  const [values, setValues] = useState<UserFormValues>(initial)
  const [validationError, setValidationError] = useState<string | null>(null)

  const update = (patch: Partial<UserFormValues>) => setValues((current) => ({ ...current, ...patch }))

  const changeRole = (role: UserRole) =>
    setValues((current) => ({
      ...current,
      role,
      hallIds: normalizeHalls(role, current.hallIds),
      merchantId: role === 'merchant' ? current.merchantId : '',
      jobTitle: role === 'merchant' ? '' : current.jobTitle,
    }))

  const toggleHall = (hallId: string) =>
    update({
      hallIds: values.hallIds.includes(hallId)
        ? values.hallIds.filter((id) => id !== hallId)
        : [...values.hallIds, hallId],
    })

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    setValidationError(null)

    if (!values.firstName.trim() || !values.lastName.trim()) {
      return setValidationError('Renseignez le prénom et le nom.')
    }
    if (mode === 'create' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
      return setValidationError('Adresse e-mail invalide.')
    }
    if (values.role === 'merchant' && !values.merchantId) {
      return setValidationError('Choisissez le stand (commerçant) de ce compte.')
    }
    if (values.role === 'hall_manager' && values.hallIds.length !== 1) {
      return setValidationError('Choisissez la halle de ce responsable.')
    }
    if (values.role === 'network_manager' && values.hallIds.length === 0) {
      return setValidationError('Cochez au moins une halle.')
    }

    onSubmit({
      ...values,
      email: values.email.trim().toLowerCase(),
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      jobTitle: values.jobTitle.trim(),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" aria-label={mode === 'create' ? 'Ajouter un compte' : 'Modifier un compte'}>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Prénom</span>
          <input
            className="brand-input mt-1 w-full"
            value={values.firstName}
            onChange={(event) => update({ firstName: event.target.value })}
            maxLength={80}
          />
        </label>
        <label className="block">
          <span className={labelClass}>Nom</span>
          <input
            className="brand-input mt-1 w-full"
            value={values.lastName}
            onChange={(event) => update({ lastName: event.target.value })}
            maxLength={80}
          />
        </label>
        <label className="block md:col-span-2">
          <span className={labelClass}>Adresse e-mail (identifiant de connexion)</span>
          <input
            type="email"
            className="brand-input mt-1 w-full disabled:opacity-60"
            value={values.email}
            disabled={mode === 'edit'}
            onChange={(event) => update({ email: event.target.value })}
            maxLength={254}
          />
        </label>
      </div>

      <label className="block">
        <span className={labelClass}>Niveau d’accès</span>
        <select
          className="brand-input mt-1 w-full disabled:opacity-60"
          value={values.role}
          disabled={lockRole}
          onChange={(event) => changeRole(event.target.value as UserRole)}
        >
          {ROLE_ORDER.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-sm text-[#615b51]">{ROLE_DESCRIPTIONS[values.role]}</span>
        {lockRole ? <span className="mt-1 block text-xs text-[#8a8377]">Vous ne pouvez pas modifier votre propre niveau d’accès.</span> : null}
      </label>

      {values.role === 'merchant' ? (
        <label className="block">
          <span className={labelClass}>Stand (commerçant)</span>
          <select
            className="brand-input mt-1 w-full"
            value={values.merchantId}
            onChange={(event) => update({ merchantId: event.target.value })}
          >
            <option value="">Sélectionner…</option>
            {options.halls.map((hall) => (
              <optgroup key={hall.id} label={hall.name}>
                {options.merchants
                  .filter((merchant) => merchant.hallId === hall.id)
                  .map((merchant) => (
                    <option key={merchant.id} value={merchant.id}>
                      {merchant.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
      ) : null}

      {values.role === 'hall_manager' ? (
        <label className="block">
          <span className={labelClass}>Halle</span>
          <select
            className="brand-input mt-1 w-full"
            value={values.hallIds[0] ?? ''}
            onChange={(event) => update({ hallIds: event.target.value ? [event.target.value] : [] })}
          >
            <option value="">Sélectionner…</option>
            {options.halls.map((hall) => (
              <option key={hall.id} value={hall.id}>
                {hall.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {values.role === 'network_manager' ? (
        <fieldset>
          <legend className={labelClass}>Halles gérées</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {options.halls.map((hall) => (
              <label key={hall.id} className="flex items-center gap-2 text-sm text-[#171511]">
                <input
                  type="checkbox"
                  checked={values.hallIds.includes(hall.id)}
                  onChange={() => toggleHall(hall.id)}
                />
                {hall.name}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {values.role === 'hq' || values.role === 'super_admin' ? (
        <p className="bg-[#e8f0f8] px-3 py-2 text-sm text-[#171511]">Ce niveau voit toutes les halles : aucun périmètre à définir.</p>
      ) : null}

      {values.role !== 'merchant' ? (
        <label className="block">
          <span className={labelClass}>Intitulé de poste (facultatif)</span>
          <input
            className="brand-input mt-1 w-full"
            list="job-title-suggestions"
            value={values.jobTitle}
            onChange={(event) => update({ jobTitle: event.target.value })}
            maxLength={80}
          />
          <datalist id="job-title-suggestions">
            {JOB_TITLE_SUGGESTIONS.map((title) => (
              <option key={title} value={title} />
            ))}
          </datalist>
        </label>
      ) : null}

      {validationError ? (
        <p role="alert" className="bg-[#fdeee9] px-3 py-2 text-sm font-semibold text-[#9b2c15]">
          {validationError}
        </p>
      ) : null}

      <div className="flex gap-3">
        <button type="submit" className="brand-button" disabled={submitting}>
          {submitting ? 'Enregistrement…' : mode === 'create' ? 'Créer le compte' : 'Enregistrer'}
        </button>
        <button
          type="button"
          className="rounded-full border px-4 py-2 text-sm font-bold text-[#171511] hover:bg-[#f7e7b8]"
          onClick={onCancel}
        >
          Annuler
        </button>
      </div>
    </form>
  )
}
