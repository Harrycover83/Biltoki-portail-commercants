import { Router } from 'express'
import type { Config } from '../config.js'
import type { SupabaseAdmin } from '../db/supabase.js'
import type { Logger } from '../utils/logger.js'
import { PennylaneClient } from '../integrations/pennylane/client.js'
import { asyncHandler } from '../middleware/async-handler.js'
import { requireStaffForHall } from '../middleware/auth.js'
import { PennylaneSync, type SyncResult } from '../services/sync.service.js'
import { syncLock } from '../services/sync-lock.js'

const GENERIC_SYNC_ERROR = 'Certaines factures n’ont pas pu être synchronisées. Contactez l’administrateur.'

/**
 * Pennylane sync triggers, mounted on /api/sync/pennylane.
 * Open to any staff account allowed to sync, limited to the halls in its scope (or the ops token).
 */
export function createHallSyncRouter(config: Config, db: SupabaseAdmin, logger: Logger) {
  const router = Router()
  const guard = requireStaffForHall(config, db, logger)

  const trigger = (label: string, run: (sync: PennylaneSync) => Promise<SyncResult>) =>
    asyncHandler(async (req, res) => {
      const { hallId } = req.params

      if (!config.biltoki.hallsToSync.includes(hallId)) {
        return res.status(403).json({ error: 'Hall not in configured sync list' })
      }

      logger.info(`${label} triggered for hall: ${hallId} by ${res.locals.caller}`)

      if (syncLock.isRunning(hallId)) {
        return res.status(409).json({ error: 'Sync already running for this hall', hallId })
      }

      try {
        const pennylane = new PennylaneClient(config.pennylane.apiKey, config.pennylane.apiUrl, logger)
        const result = await syncLock.runExclusive(hallId, () => run(new PennylaneSync(db, pennylane, hallId, logger)))

        // Raw errors can contain database details: only the super admin / ops token get them.
        const canSeeErrors = res.locals.callerRole === 'super_admin' || res.locals.callerRole === 'internal'
        return res.status(200).json({
          syncId: result.syncId,
          hallId: result.hallId,
          status: result.status,
          recordsProcessed: result.recordsProcessed,
          errors: canSeeErrors ? result.errors : result.errors.length > 0 ? [GENERIC_SYNC_ERROR] : [],
        })
      } catch (error) {
        logger.error({ err: error }, `${label} error`)
        return res.status(500).json({ error: 'Sync failed' })
      }
    })

  router.post('/:hallId', guard, trigger('Manual sync', (sync) => sync.syncServiceCharges()))

  // One-off full historical import (every invoice ever categorized, not just recent months).
  router.post('/:hallId/backfill', guard, trigger('Full history backfill', (sync) => sync.backfillHistory()))

  return router
}

/** Sync monitoring routes. Must be mounted on /api behind requireSuperAdmin. */
export function createSyncOperationsRouter(config: Config, db: SupabaseAdmin, logger: Logger) {
  const router = Router()

  router.get('/sync/pennylane/:syncId', async (req, res) => {
    try {
      const { data, error } = await db.from('pennylane_syncs').select('*').eq('id', req.params.syncId).single()
      if (error) {
        return res.status(404).json({ error: 'Sync not found' })
      }

      return res.json(data)
    } catch (error) {
      logger.error({ err: error }, 'Error fetching sync')
      return res.status(500).json({ error: 'Failed to fetch sync status' })
    }
  })

  router.get('/halls', (_req, res) => {
    res.json({ halls: config.biltoki.hallsToSync, count: config.biltoki.hallsToSync.length })
  })

  router.get('/sync/locks', (_req, res) => {
    const halls = config.biltoki.hallsToSync.map((hallId) => ({ hallId, running: syncLock.isRunning(hallId) }))
    res.json({ activeCount: halls.filter((hall) => hall.running).length, halls })
  })

  return router
}
