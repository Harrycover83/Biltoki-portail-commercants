import { timingSafeEqual } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'
import type { Config } from '../config.js'
import type { SupabaseAdmin } from '../db/supabase.js'
import type { Logger } from '../utils/logger.js'
import { isGlobalRole, isHallScopedRole, canSyncRole } from '../auth/roles.js'

function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a)
  const bufferB = Buffer.from(b)

  if (bufferA.length !== bufferB.length) {
    return false
  }

  return timingSafeEqual(bufferA, bufferB)
}

/**
 * Guards routes for any active portal account.
 * An account that still has to rotate its provisional password is refused everywhere except on the
 * route that performs the rotation (allowPasswordChangePending).
 */
export function requirePortalUser(
  _config: Config,
  db: SupabaseAdmin,
  logger: Logger,
  options: { allowPasswordChangePending?: boolean } = {},
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const [scheme, token] = (req.header('authorization') ?? '').split(' ')
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { data, error } = await db.auth.getUser(token)
    if (error || !data.user) {
      logger.warn(`Rejected access token from ${req.ip} on ${req.method} ${req.path}`)
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const [{ data: profile }, { data: access }] = await Promise.all([
      db.from('profiles').select('role').eq('id', data.user.id).maybeSingle(),
      db.from('portal_access').select('id').eq('user_id', data.user.id).eq('active', true).maybeSingle(),
    ])

    if (!profile || !access) {
      logger.warn(`Forbidden API access by ${data.user.email} on ${req.method} ${req.path}`)
      return res.status(403).json({ error: 'Forbidden' })
    }

    const appMetadata = (data.user.app_metadata ?? {}) as Record<string, unknown>
    if (appMetadata.must_change_password === true && !options.allowPasswordChangePending) {
      return res.status(403).json({ error: 'Password change required', code: 'password_change_required' })
    }

    res.locals.caller = data.user.id
    res.locals.callerEmail = data.user.email ?? null
    res.locals.callerRole = profile.role
    res.locals.callerAppMetadata = appMetadata
    return next()
  }
}

/**
 * Guards the /api routes: only the administrateur total (super_admin) can trigger syncs
 * and manage accounts. Also accepts the machine-to-machine token used by ops tooling.
 */
export function requireSuperAdmin(config: Config, db: SupabaseAdmin, logger: Logger) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const internalToken = req.header('x-internal-token')
    if (internalToken) {
      if (config.server.internalApiToken && safeEqual(internalToken, config.server.internalApiToken)) {
        res.locals.caller = 'internal-token'
        res.locals.callerRole = 'internal'
        return next()
      }

      logger.warn(`Rejected internal token from ${req.ip} on ${req.method} ${req.path}`)
      return res.status(403).json({ error: 'Forbidden' })
    }

    return requirePortalUser(config, db, logger)(req, res, () => {
      if (res.locals.callerRole !== 'super_admin') {
        logger.warn(`Forbidden API access by ${res.locals.caller} on ${req.method} ${req.path}`)
        return res.status(403).json({ error: 'Forbidden' })
      }
      return next()
    })
  }
}

/**
 * Hall-scoped Pennylane sync: hall managers, network managers and the super admin, only on a hall
 * they can see (hq is read-only). The ops token keeps working as before.
 */
export function requireStaffForHall(config: Config, db: SupabaseAdmin, logger: Logger) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.header('x-internal-token')) {
      return requireSuperAdmin(config, db, logger)(req, res, next)
    }

    return requirePortalUser(config, db, logger)(req, res, async () => {
      try {
        const hallId = req.params.hallId
        const allowed =
          canSyncRole(res.locals.callerRole) &&
          typeof hallId === 'string' &&
          (await canReadHall(db, res.locals.caller, res.locals.callerRole, hallId))

        if (!allowed) {
          logger.warn(`Forbidden hall action by ${res.locals.caller} on ${req.method} ${req.path}`)
          return res.status(403).json({ error: 'Forbidden' })
        }
        return next()
      } catch (error) {
        logger.error({ err: error }, 'Hall access check failed')
        return res.status(500).json({ error: 'Unable to verify access' })
      }
    })
  }
}

/** Account administration: a signed-in super_admin only, never the machine token. */
export function requireSuperAdminUser(config: Config, db: SupabaseAdmin, logger: Logger) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.header('x-internal-token')) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    return requireSuperAdmin(config, db, logger)(req, res, next)
  }
}

/** True when the account may read the data of this hall (same rules as the database policies). */
export async function canReadHall(
  db: SupabaseAdmin,
  userId: string,
  role: string,
  hallId: string,
): Promise<boolean> {
  if (isGlobalRole(role)) {
    return true
  }

  if (isHallScopedRole(role)) {
    const { data } = await db
      .from('admin_hall_permissions')
      .select('id')
      .eq('profile_id', userId)
      .eq('hall_id', hallId)
      .maybeSingle()
    return Boolean(data)
  }

  if (role !== 'merchant') {
    return false
  }

  const { data: permission } = await db
    .from('merchant_hall_permissions')
    .select('id')
    .eq('profile_id', userId)
    .eq('hall_id', hallId)
    .maybeSingle()
  if (permission) {
    return true
  }

  const { data: profile } = await db
    .from('profiles')
    .select('merchants!inner(hall_id)')
    .eq('id', userId)
    .maybeSingle()
  const merchant = profile?.merchants as { hall_id: string } | { hall_id: string }[] | null | undefined
  const merchantHallId = (Array.isArray(merchant) ? merchant[0] : merchant)?.hall_id
  return merchantHallId === hallId
}
