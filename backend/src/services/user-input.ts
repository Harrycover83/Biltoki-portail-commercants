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
    return { ok: false, error: 'Corps de requete invalide.' }
  }
  const raw = body as Record<string, unknown>

  const email = typeof raw.email === 'string' ? raw.email.trim().toLowerCase() : ''
  if (options.requireEmail && (!EMAIL_PATTERN.test(email) || email.length > 254)) {
    return { ok: false, error: 'Adresse e-mail invalide.' }
  }

  const firstName = cleanText(raw.firstName, 80)
  const lastName = cleanText(raw.lastName, 80)
  if (!firstName || !lastName) {
    return { ok: false, error: 'Le prenom et le nom sont obligatoires.' }
  }

  if (!isUserRole(raw.role)) {
    return { ok: false, error: 'Role invalide.' }
  }
  const role = raw.role

  const jobTitle = raw.jobTitle === undefined || raw.jobTitle === null || raw.jobTitle === ''
    ? null
    : cleanText(raw.jobTitle, 80)
  if (raw.jobTitle && !jobTitle) {
    return { ok: false, error: 'Intitule de poste invalide.' }
  }

  const merchantId = raw.merchantId === '' ? null : (raw.merchantId ?? null)
  if (merchantId !== null && !isUuid(merchantId)) {
    return { ok: false, error: 'Commercant invalide.' }
  }

  const rawHalls = raw.hallIds ?? []
  if (!Array.isArray(rawHalls) || rawHalls.length > 100 || !rawHalls.every(isUuid)) {
    return { ok: false, error: 'Liste de halles invalide.' }
  }
  const hallIds = [...new Set(rawHalls as string[])]

  if (role === 'merchant') {
    if (!merchantId) {
      return { ok: false, error: 'Selectionnez le commercant (stand) associe a ce compte.' }
    }
    if (hallIds.length > 0) {
      return { ok: false, error: 'Un compte commercant n’a pas de perimetre de halles.' }
    }
  } else {
    if (merchantId) {
      return { ok: false, error: 'Seul un compte commercant peut etre lie a un stand.' }
    }
    if (role === 'hall_manager' && hallIds.length !== 1) {
      return { ok: false, error: 'Un responsable de halle est rattache a exactement une halle.' }
    }
    if (role === 'network_manager' && hallIds.length < 1) {
      return { ok: false, error: 'Un responsable reseau doit gerer au moins une halle.' }
    }
    if (!isHallScopedRole(role) && hallIds.length > 0) {
      return { ok: false, error: 'Ce role voit toutes les halles : aucun perimetre a definir.' }
    }
  }

  return { ok: true, value: { email, firstName, lastName, role, jobTitle, merchantId, hallIds } }
}
