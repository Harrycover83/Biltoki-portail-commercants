import { timingSafeEqual } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'
import type { Config } from '../config.js'
import type { SupabaseAdmin } from '../db/supabase.js'
import type { Logger } from '../utils/logger.js'

function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a)
  const bufferB = Buffer.from(b)

  if (bufferA.length !== bufferB.length) {
    return false
  }

  return timingSafeEqual(bufferA, bufferB)
}

/**
 * Guards the /api routes. Accepts either a Supabase access token belonging to an
 * active admin of the portal, or the machine-to-machine token used by ops tooling.
 */
export function requireAdmin(config: Config, db: SupabaseAdmin, logger: Logger) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const internalToken = req.header('x-internal-token')
    if (internalToken) {
      if (config.server.internalApiToken && safeEqual(internalToken, config.server.internalApiToken)) {
        res.locals.caller = 'internal-token'
        return next()
      }

      logger.warn(`Rejected internal token from ${req.ip} on ${req.method} ${req.path}`)
      return res.status(403).json({ error: 'Forbidden' })
    }

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

    if (profile?.role !== 'admin' || !access) {
      logger.warn(`Forbidden API access by ${data.user.email} on ${req.method} ${req.path}`)
      return res.status(403).json({ error: 'Forbidden' })
    }

    res.locals.caller = data.user.id
    return next()
  }
}
