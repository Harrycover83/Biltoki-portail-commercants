import { Router } from 'express'
import type { SupabaseAdmin } from '../db/supabase.js'
import type { Logger } from '../utils/logger.js'

/** Liveness (`/health`) and readiness (`/ready`) probes, public by design. */
export function createHealthRouter(db: SupabaseAdmin, logger: Logger) {
  const router = Router()

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  })

  // Readiness: verifies the database is reachable.
  router.get('/ready', async (_req, res) => {
    try {
      const { error } = await db.from('halls').select('id').limit(1)
      if (error) {
        res.status(503).json({ status: 'not-ready', reason: 'database-check-failed' })
        return
      }

      res.json({ status: 'ready', timestamp: new Date().toISOString() })
    } catch (error) {
      logger.error({ err: error }, 'Readiness check failed')
      res.status(503).json({ status: 'not-ready', reason: 'unexpected-error' })
    }
  })

  return router
}
