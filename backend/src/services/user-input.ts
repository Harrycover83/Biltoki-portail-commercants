import { isHallScopedRole, isUserRole, type UserRole } from '../auth/roles.js'

export type UserInput = {
  email: string
  firstName: string
  lastName: string
  role: UserRole
  jobTitle: string | null
  merchantId: string | null
  hallIds: string[]
}

type ValidationResult = { ok: true; value: UserInput } | { ok: false; error: string }

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length > 0 && trimmed.length <= maxLength ? trimmed : null
}

/**
 * Validates an account payload received from the Administration screen.
 * The database enforces the same rules (admin_save_user_access); this gives clear errors early.
 */
export function validateUserInput(body: unknown, options: { requireEmail: boolean }): ValidationResult {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Corps de requête invalide.' }
  }
  const raw = body as Record<string, unknown>

  const email = typeof raw.email === 'string' ? raw.email.trim().toLowerCase() : ''
  if (options.requireEmail && (!EMAIL_PATTERN.test(email) || email.length > 254)) {
    return { ok: false, error: 'Adresse e-mail invalide.' }
  }

  const firstName = cleanText(raw.firstName, 80)
  const lastName = cleanText(raw.lastName, 80)
  if (!firstName || !lastName) {
    return { ok: false, error: 'Le prénom et le nom sont obligatoires.' }
  }

  if (!isUserRole(raw.role)) {
    return { ok: false, error: 'Role invalide.' }
  }
  const role = raw.role

  const jobTitle = raw.jobTitle === undefined || raw.jobTitle === null || raw.jobTitle === ''
    ? null
    : cleanText(raw.jobTitle, 80)
  if (raw.jobTitle && !jobTitle) {
    return { ok: false, error: 'Intitulé de poste invalide.' }
  }

  const merchantId = raw.merchantId === '' ? null : (raw.merchantId ?? null)
  if (merchantId !== null && !isUuid(merchantId)) {
    return { ok: false, error: 'Commerçant invalide.' }
  }

  const rawHalls = raw.hallIds ?? []
  if (!Array.isArray(rawHalls) || rawHalls.length > 100 || !rawHalls.every(isUuid)) {
    return { ok: false, error: 'Liste de halles invalide.' }
  }
  const hallIds = [...new Set(rawHalls as string[])]

  if (role === 'merchant') {
    if (!merchantId) {
      return { ok: false, error: 'Sélectionnez le commerçant (stand) associé à ce compte.' }
    }
    if (hallIds.length > 0) {
      return { ok: false, error: 'Un compte commerçant n’a pas de périmètre de halles.' }
    }
  } else {
    if (merchantId) {
      return { ok: false, error: 'Seul un compte commerçant peut être lié à un stand.' }
    }
    if (role === 'hall_manager' && hallIds.length !== 1) {
      return { ok: false, error: 'Un responsable de halle est rattaché à exactement une halle.' }
    }
    if (role === 'network_manager' && hallIds.length < 1) {
      return { ok: false, error: 'Un responsable réseau doit gérer au moins une halle.' }
    }
    if (!isHallScopedRole(role) && hallIds.length > 0) {
      return { ok: false, error: 'Ce rôle voit toutes les halles : aucun périmètre à définir.' }
    }
  }

  return { ok: true, value: { email, firstName, lastName, role, jobTitle, merchantId, hallIds } }
}
