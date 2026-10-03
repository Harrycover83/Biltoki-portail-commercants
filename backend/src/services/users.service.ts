import { randomInt } from 'node:crypto'
import type { SupabaseAdmin } from '../db/supabase.js'
import type { Logger } from '../utils/logger.js'
import type { UserRole } from '../auth/roles.js'
import type { UserInput } from './user-input.js'

const BAN_FOREVER = '876000h'
const PASSWORD_LENGTH = 14
// Ambiguous characters (O/0, l/1, I) are excluded: passwords are read aloud or retyped.
const LOWER = 'abcdefghijkmnpqrstuvwxyz'
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const DIGITS = '23456789'
const SPECIALS = '!@#$%&*?'

export class UserAdminError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

export type Actor = { id: string | null; email: string | null }

export type UserAccount = {
  userId: string | null
  email: string
  firstName: string | null
  lastName: string | null
  role: UserRole
  jobTitle: string | null
  merchantId: string | null
  hallIds: string[]
  active: boolean
  provisioned: boolean
  lastSignInAt: string | null
}

type AccessRow = {
  email: string
  first_name: string | null
  last_name: string | null
  role: UserRole
  job_title: string | null
  merchant_id: string | null
  active: boolean
  user_id: string | null
}

export function generatePassword(): string {
  const pick = (alphabet: string) => alphabet[randomInt(alphabet.length)]
  const all = LOWER + UPPER + DIGITS + SPECIALS
  const chars = [pick(LOWER), pick(UPPER), pick(DIGITS), pick(SPECIALS)]
  while (chars.length < PASSWORD_LENGTH) {
    chars.push(pick(all))
  }
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

/** Maps database errors raised by admin_save_user_access to user-facing messages. */
function toAdminError(error: { message: string; code?: string }): UserAdminError {
  if (error.code === '23514' || error.code === '22023') {
    return new UserAdminError(error.message, 400)
  }
  return new UserAdminError('Operation impossible pour le moment.', 500)
}

export class UserAdminService {
  constructor(
    private readonly db: SupabaseAdmin,
    private readonly logger: Logger,
  ) {}

  private async audit(actor: Actor, action: string, targetEmail: string | null, details: Record<string, unknown> = {}) {
    const { error } = await this.db.from('admin_audit_log').insert({
      actor_id: actor.id,
      actor_email: actor.email,
      action,
      target_email: targetEmail,
      details,
    })
    if (error) {
      this.logger.error('Unable to write audit log:', error)
    }
  }

  private async findAuthUser(userId: string) {
    const { data, error } = await this.db.auth.admin.getUserById(userId)
    if (error || !data.user) {
      throw new UserAdminError('Compte introuvable.', 404)
    }
    return data.user
  }

  private async loadAccess(userId: string): Promise<{ access: AccessRow; hallIds: string[] }> {
    const { data: access, error } = await this.db
      .from('portal_access')
      .select('email, first_name, last_name, role, job_title, merchant_id, active, user_id')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) {
      throw new UserAdminError('Operation impossible pour le moment.', 500)
    }
    if (!access) {
      throw new UserAdminError('Compte introuvable.', 404)
    }

    const { data: scopes } = await this.db
      .from('admin_hall_permissions')
      .select('hall_id')
      .eq('profile_id', userId)

    return { access: access as AccessRow, hallIds: (scopes ?? []).map((row) => row.hall_id as string) }
  }

  private async saveAccess(userId: string, input: UserInput, active: boolean) {
    const { error } = await this.db.rpc('admin_save_user_access', {
      p_user_id: userId,
      p_email: input.email,
      p_first_name: input.firstName,
      p_last_name: input.lastName,
      p_role: input.role,
      p_job_title: input.jobTitle,
      p_merchant_id: input.merchantId,
      p_hall_ids: input.hallIds,
      p_active: active,
    })
    if (error) {
      throw toAdminError(error)
    }
  }

  async listUsers(): Promise<UserAccount[]> {
    const [{ data: entries, error }, { data: scopes }] = await Promise.all([
      this.db
        .from('portal_access')
        .select('email, first_name, last_name, role, job_title, merchant_id, active, user_id')
        .order('email'),
      this.db.from('admin_hall_permissions').select('profile_id, hall_id'),
    ])
    if (error) {
      throw new UserAdminError('Operation impossible pour le moment.', 500)
    }

    const hallsByProfile = new Map<string, string[]>()
    for (const row of scopes ?? []) {
      const list = hallsByProfile.get(row.profile_id as string) ?? []
      list.push(row.hall_id as string)
      hallsByProfile.set(row.profile_id as string, list)
    }

    const lastSignIn = new Map<string, string | null>()
    for (let page = 1; ; page += 1) {
      const { data, error: listError } = await this.db.auth.admin.listUsers({ page, perPage: 200 })
      if (listError) {
        break
      }
      for (const user of data.users) {
        lastSignIn.set(user.id, user.last_sign_in_at ?? null)
      }
      if (data.users.length < 200) {
        break
      }
    }

    return ((entries ?? []) as AccessRow[]).map((entry) => ({
      userId: entry.user_id,
      email: entry.email,
      firstName: entry.first_name,
      lastName: entry.last_name,
      role: entry.role,
      jobTitle: entry.job_title,
      merchantId: entry.merchant_id,
      hallIds: entry.user_id ? (hallsByProfile.get(entry.user_id) ?? []) : [],
      active: entry.active,
      provisioned: entry.user_id !== null,
      lastSignInAt: entry.user_id ? (lastSignIn.get(entry.user_id) ?? null) : null,
    }))
  }

  async getOptions() {
    const [{ data: halls }, { data: merchants }] = await Promise.all([
      this.db.from('halls').select('id, name').order('name'),
      this.db.from('merchants').select('id, legal_name, trade_name, hall_id').order('legal_name'),
    ])
    return {
      halls: (halls ?? []).map((hall) => ({ id: hall.id as string, name: hall.name as string })),
      merchants: (merchants ?? []).map((merchant) => ({
        id: merchant.id as string,
        name: ((merchant.trade_name as string | null) ?? (merchant.legal_name as string)) as string,
        hallId: merchant.hall_id as string,
      })),
    }
  }

  async listAudit(limit = 50) {
    const { data, error } = await this.db
      .from('admin_audit_log')
      .select('id, actor_email, action, target_email, details, created_at')
      .order('created_at', { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 200))
    if (error) {
      throw new UserAdminError('Operation impossible pour le moment.', 500)
    }
    return data ?? []
  }

  async createUser(input: UserInput, actor: Actor): Promise<{ userId: string; provisionalPassword: string }> {
    const provisionalPassword = generatePassword()
    const { data, error } = await this.db.auth.admin.createUser({
      email: input.email,
      password: provisionalPassword,
      email_confirm: true,
      user_metadata: { must_change_password: true },
    })

    if (error || !data.user) {
      const exists = error?.message?.toLowerCase().includes('already')
      throw new UserAdminError(
        exists ? 'Un compte existe deja avec cette adresse e-mail.' : 'Creation du compte impossible.',
        exists ? 409 : 500,
      )
    }

    try {
      await this.saveAccess(data.user.id, input, true)
    } catch (saveError) {
      await this.db.auth.admin.deleteUser(data.user.id)
      throw saveError
    }

    await this.audit(actor, 'user.create', input.email, {
      role: input.role,
      jobTitle: input.jobTitle,
      merchantId: input.merchantId,
      hallIds: input.hallIds,
    })
    return { userId: data.user.id, provisionalPassword }
  }

  async updateUser(userId: string, input: Omit<UserInput, 'email'>, actor: Actor): Promise<void> {
    const { access } = await this.loadAccess(userId)

    if (userId === actor.id && input.role !== 'super_admin') {
      throw new UserAdminError('Vous ne pouvez pas modifier votre propre role.', 400)
    }

    await this.saveAccess(userId, { ...input, email: access.email }, access.active)
    await this.audit(actor, 'user.update', access.email, {
      from: { role: access.role, jobTitle: access.job_title, merchantId: access.merchant_id },
      to: { role: input.role, jobTitle: input.jobTitle, merchantId: input.merchantId, hallIds: input.hallIds },
    })
  }

  async setActive(userId: string, active: boolean, actor: Actor): Promise<void> {
    if (userId === actor.id && !active) {
      throw new UserAdminError('Vous ne pouvez pas desactiver votre propre compte.', 400)
    }

    const { access, hallIds } = await this.loadAccess(userId)
    await this.saveAccess(
      userId,
      {
        email: access.email,
        firstName: access.first_name ?? '',
        lastName: access.last_name ?? '',
        role: access.role,
        jobTitle: access.job_title,
        merchantId: access.merchant_id,
        hallIds,
      },
      active,
    )

    const { error } = await this.db.auth.admin.updateUserById(userId, {
      ban_duration: active ? 'none' : BAN_FOREVER,
    })
    if (error) {
      this.logger.error('Unable to update the auth ban state:', error)
      throw new UserAdminError('Statut mis a jour, mais la session n’a pas pu etre bloquee.', 500)
    }

    await this.audit(actor, active ? 'user.activate' : 'user.deactivate', access.email)
  }

  async resetPassword(userId: string, actor: Actor): Promise<{ provisionalPassword: string }> {
    const user = await this.findAuthUser(userId)
    const { access } = await this.loadAccess(userId)

    const provisionalPassword = generatePassword()
    const { error } = await this.db.auth.admin.updateUserById(userId, {
      password: provisionalPassword,
      user_metadata: { ...user.user_metadata, must_change_password: true },
    })
    if (error) {
      throw new UserAdminError('Reinitialisation impossible.', 500)
    }

    await this.audit(actor, 'user.reset_password', access.email)
    return { provisionalPassword }
  }

  async deleteUser(userId: string, actor: Actor): Promise<void> {
    if (userId === actor.id) {
      throw new UserAdminError('Vous ne pouvez pas supprimer votre propre compte.', 400)
    }

    const { access } = await this.loadAccess(userId)

    // The profile is cascade-deleted; the database refuses to remove the last super_admin.
    const { error } = await this.db.auth.admin.deleteUser(userId)
    if (error) {
      this.logger.error('Unable to delete auth user:', error)
      throw new UserAdminError('Suppression impossible (dernier administrateur total ?).', 409)
    }

    await this.db.from('portal_access').delete().eq('email', access.email)
    await this.audit(actor, 'user.delete', access.email, { role: access.role })
  }
}
