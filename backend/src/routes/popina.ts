import { Router } from 'express'
import type { Config } from '../config.js'
import type { SupabaseAdmin } from '../db/supabase.js'
import type { Logger } from '../utils/logger.js'
import { isStaffRole } from '../auth/roles.js'
import { canReadHall, requirePortalUser } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/async-handler.js'
import { isUuid } from '../services/user-input.js'
import { PopinaClient } from '../integrations/popina/client.js'
import { addDays, compareRevenue, previousYear, validPeriod } from '../integrations/popina/revenue.js'

export function createPopinaRouter(config: Config, db: SupabaseAdmin, logger: Logger) {
  const router = Router()
  router.use(requirePortalUser(db, logger))
  router.get('/:hallId/revenue', asyncHandler(async (req, res) => {
    const { hallId } = req.params
    res.setHeader('Cache-Control', 'private, no-store')
    if (!isStaffRole(res.locals.callerRole)) return res.status(403).json({ error: 'Accès réservé au personnel Biltoki.' })
    if (!isUuid(hallId)) return res.status(400).json({ error: 'Identifiant de halle invalide.' })
    if (!(await canReadHall(db, res.locals.caller, res.locals.callerRole, hallId))) {
      return res.status(403).json({ error: 'Vous ne pouvez pas consulter cette halle.' })
    }
    if (hallId !== config.popina.hallId || !config.popina.apiKey || !config.popina.locationId) {
      return res.status(503).json({
        code: 'popina_not_configured',
        error: 'Popina n’est pas encore configuré pour cette halle.',
      })
    }
    const { since, until } = req.query
    if (typeof since !== 'string' || typeof until !== 'string' || !validPeriod(since, until)) {
      return res.status(400).json({ error: 'Choisissez une période passée de 1 à 93 jours (AAAA-MM-JJ).' })
    }
    try {
      const client = new PopinaClient(config.popina.apiKey)
      // Pad the range for overnight shifts and UTC/local date boundaries; aggregation filters it precisely.
      const previousSince = previousYear(since) ?? addDays(`${Number(since.slice(0, 4)) - 1}-03-01`, -1)
      const previousUntil = previousYear(until) ?? addDays(`${Number(until.slice(0, 4)) - 1}-03-01`, -1)
      const [current, previous] = await Promise.all([
        client.getReports(addDays(since, -1), addDays(until, 1), config.popina.locationId),
        client.getReports(addDays(previousSince, -1), addDays(previousUntil, 1), config.popina.locationId),
      ])
      return res.json({
        hallId, source: 'Popina', fetchedAt: new Date().toISOString(),
        ...compareRevenue(since, until, current, previous),
      })
    } catch (error) {
      logger.error({ err: error }, 'Unable to retrieve Popina revenue')
      return res.status(502).json({ error: 'Impossible de récupérer le CA Popina. Vérifiez la connexion et les droits de la clé côté serveur.' })
    }
  }))
  return router
}
